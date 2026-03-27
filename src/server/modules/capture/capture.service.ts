import { IngestionJobKind, IngestionJobStatus, IngestionStatus } from "@prisma/client";
import { RouteError } from "@/server/api/response";
import { prisma } from "@/server/db/client";
import { extractWebPage } from "@/server/extractors/web/extract-web-page";
import { queueAndRunAutomaticDocumentAiSummary } from "@/server/modules/documents/document-ai-summary-jobs.service";
import { mapDocumentDetail } from "@/server/modules/documents/document.mapper";
import {
  createWebDocument,
  createWebDocumentPlaceholder,
  findWebDocumentByUrlCandidates,
  type DocumentDetailRecord,
} from "@/server/modules/documents/document.repository";
import type { CaptureIngestionError, CaptureUrlResponseData } from "@/server/modules/documents/document.types";

export async function captureUrl(inputUrl: string): Promise<CaptureUrlResponseData> {
  const normalizedUrl = normalizeInputUrl(inputUrl);

  const existingBySourceUrl = await findWebDocumentByUrlCandidates([normalizedUrl]);
  if (existingBySourceUrl) {
    const enrichedDocument = await hydrateAutomaticSummaryIfPossible(existingBySourceUrl);

    return {
      document: mapDocumentDetail(enrichedDocument),
      deduped: true,
      jobId: null,
      ingestion: {
        error: await findLatestCaptureError(enrichedDocument),
      },
    };
  }

  const job = await prisma.ingestionJob.create({
    data: {
      kind: IngestionJobKind.FETCH_WEB_PAGE,
      status: IngestionJobStatus.PENDING,
      sourceUrl: normalizedUrl,
    },
  });

  try {
    await prisma.ingestionJob.update({
      where: { id: job.id },
      data: {
        status: IngestionJobStatus.PROCESSING,
        startedAt: new Date(),
      },
    });

    const extracted = await extractWebPage(normalizedUrl);
    const urlCandidates = Array.from(
      new Set([normalizedUrl, extracted.finalUrl, extracted.canonicalUrl].filter((value): value is string => Boolean(value))),
    );

    const existingByResolvedUrl = await findWebDocumentByUrlCandidates(urlCandidates);
    if (existingByResolvedUrl) {
      const enrichedDocument = await hydrateAutomaticSummaryIfPossible(existingByResolvedUrl);

      await prisma.ingestionJob.update({
        where: { id: job.id },
        data: {
          status: IngestionJobStatus.SUCCEEDED,
          documentId: enrichedDocument.id,
          payloadJson: {
            deduped: true,
            canonicalUrl: extracted.canonicalUrl,
            finalUrl: extracted.finalUrl,
          },
          finishedAt: new Date(),
        },
      });

      return {
        document: mapDocumentDetail(enrichedDocument),
        deduped: true,
        jobId: job.id,
        ingestion: {
          error: null,
        },
      };
    }

    const document = await createWebDocument({
      title: extracted.title,
      sourceUrl: normalizedUrl,
      canonicalUrl: extracted.canonicalUrl ?? extracted.finalUrl,
      lang: extracted.lang,
      excerpt: extracted.excerpt,
      author: extracted.author,
      publishedAt: extracted.publishedAt,
      ingestionStatus: IngestionStatus.READY,
      contentHtml: extracted.contentHtml,
      plainText: extracted.plainText,
      rawHtml: extracted.rawHtml,
      textHash: extracted.textHash,
      wordCount: extracted.wordCount,
      extractedAt: new Date(),
    });

    const enrichedDocument = await hydrateAutomaticSummaryIfPossible(document);

    await prisma.ingestionJob.update({
      where: { id: job.id },
      data: {
        status: IngestionJobStatus.SUCCEEDED,
        documentId: enrichedDocument.id,
        payloadJson: {
          deduped: false,
          canonicalUrl: enrichedDocument.canonicalUrl,
          finalUrl: extracted.finalUrl,
        },
        finishedAt: new Date(),
      },
    });

    return {
      document: mapDocumentDetail(enrichedDocument),
      deduped: false,
      jobId: job.id,
      ingestion: {
        error: null,
      },
    };
  } catch (error) {
    const ingestionError = toCaptureIngestionError(error);
    const failureResult = await getOrCreateFailedWebDocument(normalizedUrl);

    await prisma.ingestionJob.update({
      where: { id: job.id },
      data: {
        status: IngestionJobStatus.FAILED,
        documentId: failureResult.document.id,
        errorMessage: ingestionError.message,
        payloadJson: {
          error: ingestionError,
        },
        finishedAt: new Date(),
      },
    });

    return {
      document: mapDocumentDetail(failureResult.document),
      deduped: failureResult.deduped,
      jobId: job.id,
      ingestion: {
        error: ingestionError,
      },
    };
  }
}

function normalizeInputUrl(inputUrl: string) {
  const trimmed = inputUrl.trim();

  if (!trimmed) {
    throw new RouteError("INVALID_URL", 400, "URL is required.");
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(trimmed);
  } catch {
    throw new RouteError("INVALID_URL", 400, "URL must be a valid absolute URL.");
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new RouteError("INVALID_URL", 400, "Only http and https URLs are supported.");
  }

  parsedUrl.hash = "";
  return parsedUrl.toString();
}

async function getOrCreateFailedWebDocument(sourceUrl: string) {
  const existingDocument = await findWebDocumentByUrlCandidates([sourceUrl]);
  if (existingDocument) {
    return {
      document: existingDocument,
      deduped: true,
    };
  }

  const document = await createWebDocumentPlaceholder({
    title: buildPlaceholderTitle(sourceUrl),
    sourceUrl,
    canonicalUrl: null,
    ingestionStatus: IngestionStatus.FAILED,
  });

  return {
    document,
    deduped: false,
  };
}

function buildPlaceholderTitle(sourceUrl: string) {
  return new URL(sourceUrl).hostname;
}

function toCaptureIngestionError(error: unknown): CaptureIngestionError {
  if (error instanceof RouteError) {
    return {
      code: error.code,
      message: error.message,
    };
  }

  if (error instanceof Error && error.message) {
    return {
      code: "CAPTURE_FAILED",
      message: error.message,
    };
  }

  return {
    code: "CAPTURE_FAILED",
    message: "Failed to capture the webpage.",
  };
}

async function findLatestCaptureError(document: DocumentDetailRecord): Promise<CaptureIngestionError | null> {
  if (document.ingestionStatus !== IngestionStatus.FAILED) {
    return null;
  }

  const orClauses: Array<{ documentId?: string; sourceUrl?: string }> = [{ documentId: document.id }];
  if (document.sourceUrl) {
    orClauses.push({ sourceUrl: document.sourceUrl });
  }

  const failedJob = await prisma.ingestionJob.findFirst({
    where: {
      kind: IngestionJobKind.FETCH_WEB_PAGE,
      status: IngestionJobStatus.FAILED,
      OR: orClauses,
    },
    orderBy: [{ finishedAt: "desc" }, { createdAt: "desc" }],
    select: {
      payloadJson: true,
      errorMessage: true,
    },
  });

  const payloadError = extractCaptureErrorFromPayload(failedJob?.payloadJson);
  if (payloadError) {
    return payloadError;
  }

  if (failedJob?.errorMessage) {
    return {
      code: "CAPTURE_FAILED",
      message: failedJob.errorMessage,
    };
  }

  return null;
}

async function hydrateAutomaticSummaryIfPossible(document: DocumentDetailRecord) {
  try {
    return await queueAndRunAutomaticDocumentAiSummary(document);
  } catch (error) {
    console.error("Failed to generate automatic AI summary.", {
      documentId: document.id,
      error,
    });

    return document;
  }
}

function extractCaptureErrorFromPayload(payload: unknown): CaptureIngestionError | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const error = (payload as { error?: unknown }).error;
  if (!error || typeof error !== "object" || Array.isArray(error)) {
    return null;
  }

  const code = typeof (error as { code?: unknown }).code === "string" ? (error as { code: string }).code : null;
  const message =
    typeof (error as { message?: unknown }).message === "string" ? (error as { message: string }).message : null;

  if (!code || !message) {
    return null;
  }

  return {
    code,
    message,
  };
}
