import { IngestionJobKind, IngestionJobStatus, IngestionStatus, PublishedAtKind } from "@prisma/client";
import { deriveContentOriginMetadata, syncWechatSubsourceFromContentOrigin } from "@/lib/documents/content-origin";
import { RouteError } from "@/server/api/response";
import { prisma } from "@/server/db/client";
import { extractWebPage } from "@/server/extractors/web/extract-web-page";
import {
  captureVideoDocument,
  isVideoCaptureCandidate,
  resolveVideoExternalIdHint,
  type CapturedVideoDocument,
} from "@/server/modules/capture/video-capture";
import { queueAndRunAutomaticDocumentAiSummary } from "@/server/modules/documents/document-ai-summary-jobs.service";
import { mapDocumentDetail } from "@/server/modules/documents/document.mapper";
import {
  backfillHostnamePublishedAtUpperBound,
  createWebDocument,
  createWebDocumentPlaceholder,
  findDocumentByContentHash,
  findDocumentByDedupeKey,
  findLatestCaptureErrorForDocument,
  findWebDocumentByExternalId,
  findWebDocumentByUrlCandidates,
  refreshVideoWebDocument,
  type DocumentDetailRecord,
} from "@/server/modules/documents/document.repository";
import { upsertWechatSubsource } from "@/server/modules/documents/wechat-subsource.service";
import { generateDedupeKey, isTestUrl, normalizeUrl } from "@/lib/documents/dedupe";
import type { CaptureIngestionError, CaptureUrlResponseData } from "@/server/modules/documents/document.types";

export async function captureUrl(inputUrl: string): Promise<CaptureUrlResponseData> {
  if (isTestUrl(inputUrl)) {
    throw new RouteError("TEST_URL_REJECTED", 403, "URLs with test parameters are not allowed in the production library.");
  }

  const normalizedUrl = normalizeCaptureInputUrl(inputUrl);
  const dedupeKey = generateDedupeKey({ type: "WEB_PAGE", sourceUrl: normalizedUrl });

  if (dedupeKey) {
    const existingByDedupeKey = await findDocumentByDedupeKey(dedupeKey);
    if (existingByDedupeKey && (!isVideoCaptureCandidate(normalizedUrl) || !needsVideoTranscriptRefresh(existingByDedupeKey))) {
      const enrichedDocument = await hydrateAutomaticSummaryIfPossible(existingByDedupeKey);

      return {
        document: mapDocumentDetail(enrichedDocument),
        deduped: true,
        jobId: null,
        ingestion: {
          error: await findLatestCaptureError(enrichedDocument),
        },
      };
    }
  }

  const shouldTryVideoCapture = isVideoCaptureCandidate(normalizedUrl);
  const videoExternalIdHint = resolveVideoExternalIdHint(normalizedUrl);

  if (videoExternalIdHint) {
    const existingByExternalId = await findWebDocumentByExternalId(videoExternalIdHint);
    if (existingByExternalId && (!shouldTryVideoCapture || !needsVideoTranscriptRefresh(existingByExternalId))) {
      const enrichedDocument = await hydrateAutomaticSummaryIfPossible(existingByExternalId);

      return {
        document: mapDocumentDetail(enrichedDocument),
        deduped: true,
        jobId: null,
        ingestion: {
          error: await findLatestCaptureError(enrichedDocument),
        },
      };
    }
  }

  const existingBySourceUrl = await findWebDocumentByUrlCandidates([normalizedUrl]);
  if (existingBySourceUrl && (!shouldTryVideoCapture || !needsVideoTranscriptRefresh(existingBySourceUrl))) {
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

    const capturedVideo = shouldTryVideoCapture ? await captureVideoDocument(normalizedUrl) : null;
    if (capturedVideo) {
      const urlCandidates = Array.from(new Set([normalizedUrl, capturedVideo.canonicalUrl, capturedVideo.videoUrl]));
      const existingByExternalId = await findWebDocumentByExternalId(capturedVideo.externalId);
      if (existingByExternalId) {
        const refreshed = needsVideoTranscriptRefresh(existingByExternalId);
        const targetDocument = refreshed
          ? await refreshVideoDocumentFromCapture(existingByExternalId.id, normalizedUrl, capturedVideo)
          : existingByExternalId;
        const enrichedDocument = await hydrateAutomaticSummaryIfPossible(targetDocument);

        await prisma.ingestionJob.update({
          where: { id: job.id },
          data: {
            status: IngestionJobStatus.SUCCEEDED,
            documentId: enrichedDocument.id,
            payloadJson: {
              deduped: true,
              provider: capturedVideo.provider,
              externalId: capturedVideo.externalId,
              canonicalUrl: capturedVideo.canonicalUrl,
              refreshed,
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

      const existingByResolvedUrl = await findWebDocumentByUrlCandidates(urlCandidates);
      if (existingByResolvedUrl) {
        const refreshed = needsVideoTranscriptRefresh(existingByResolvedUrl);
        const targetDocument = refreshed
          ? await refreshVideoDocumentFromCapture(existingByResolvedUrl.id, normalizedUrl, capturedVideo)
          : existingByResolvedUrl;
        const enrichedDocument = await hydrateAutomaticSummaryIfPossible(targetDocument);

        await prisma.ingestionJob.update({
          where: { id: job.id },
          data: {
            status: IngestionJobStatus.SUCCEEDED,
            documentId: enrichedDocument.id,
            payloadJson: {
              deduped: true,
              provider: capturedVideo.provider,
              externalId: capturedVideo.externalId,
              canonicalUrl: capturedVideo.canonicalUrl,
              refreshed,
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

      const videoDocument = await createWebDocument({
        title: capturedVideo.title,
        sourceUrl: normalizedUrl,
        canonicalUrl: capturedVideo.canonicalUrl,
        dedupeKey: generateDedupeKey({
          type: "WEB_PAGE",
          sourceUrl: normalizedUrl,
          canonicalUrl: capturedVideo.canonicalUrl,
          externalId: capturedVideo.externalId,
        }),
        externalId: capturedVideo.externalId,
        lang: capturedVideo.lang,
        excerpt: capturedVideo.excerpt,
        author: capturedVideo.author,
        contentOriginKey: null,
        contentOriginLabel: null,
        videoUrl: capturedVideo.videoUrl,
        videoProvider: capturedVideo.provider,
        videoThumbnailUrl: capturedVideo.videoThumbnailUrl,
        videoDurationSeconds: capturedVideo.videoDurationSeconds,
        transcriptSegments: capturedVideo.transcriptSegments,
        publishedAt: capturedVideo.publishedAt,
        publishedAtKind: capturedVideo.publishedAt ? PublishedAtKind.EXACT : PublishedAtKind.UNKNOWN,
        ingestionStatus: IngestionStatus.READY,
        contentHtml: null,
        plainText: capturedVideo.plainText,
        rawHtml: null,
        textHash: capturedVideo.textHash,
        wordCount: capturedVideo.wordCount,
        extractedAt: new Date(),
      });

      const sourceHostname = resolveSourceHostname(capturedVideo.canonicalUrl);
      if (capturedVideo.publishedAt && sourceHostname) {
        await backfillHostnamePublishedAtUpperBound({
          hostname: sourceHostname,
          anchorCreatedAt: videoDocument.createdAt,
          upperBoundPublishedAt: capturedVideo.publishedAt,
        });
      }

      const enrichedDocument = await hydrateAutomaticSummaryIfPossible(videoDocument);

      await prisma.ingestionJob.update({
        where: { id: job.id },
        data: {
          status: IngestionJobStatus.SUCCEEDED,
          documentId: enrichedDocument.id,
          payloadJson: {
            deduped: false,
            provider: capturedVideo.provider,
            externalId: capturedVideo.externalId,
            canonicalUrl: capturedVideo.canonicalUrl,
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
    }

    const extracted = await extractWebPage(normalizedUrl);
    
    // Compute final dedupe key after extraction (which might provide a better canonical URL)
    const finalDedupeKey = generateDedupeKey({
      type: "WEB_PAGE",
      sourceUrl: normalizedUrl,
      canonicalUrl: extracted.canonicalUrl ?? extracted.finalUrl,
    });

    if (finalDedupeKey) {
      const existingByFinalKey = await findDocumentByDedupeKey(finalDedupeKey);
      if (existingByFinalKey) {
        const enrichedDocument = await hydrateAutomaticSummaryIfPossible(existingByFinalKey);
        await prisma.ingestionJob.update({
          where: { id: job.id },
          data: {
            status: IngestionJobStatus.SUCCEEDED,
            documentId: enrichedDocument.id,
            payloadJson: { deduped: true, reason: "final_dedupe_key_match" },
            finishedAt: new Date(),
          },
        });
        return { document: mapDocumentDetail(enrichedDocument), deduped: true, jobId: job.id, ingestion: { error: null } };
      }
    }

    // Secondary dedupe check by content hash
    const existingByContentHash = await findDocumentByContentHash(extracted.textHash);
    if (existingByContentHash) {
      const enrichedDocument = await hydrateAutomaticSummaryIfPossible(existingByContentHash);
      await prisma.ingestionJob.update({
        where: { id: job.id },
        data: {
          status: IngestionJobStatus.SUCCEEDED,
          documentId: enrichedDocument.id,
          payloadJson: { deduped: true, reason: "content_hash_match" },
          finishedAt: new Date(),
        },
      });
      return { document: mapDocumentDetail(enrichedDocument), deduped: true, jobId: job.id, ingestion: { error: null } };
    }

    const derivedContentOrigin = deriveContentOriginMetadata({
      author: extracted.author,
      canonicalUrl: extracted.canonicalUrl,
      finalUrl: extracted.finalUrl,
      rawHtml: extracted.rawHtml,
      sourceUrl: normalizedUrl,
      wechatAccountName: extracted.wechatAccountName,
    });
    await syncWechatSubsourceFromContentOrigin(
      derivedContentOrigin,
      {
        wechatAccountName: extracted.wechatAccountName,
      },
      upsertWechatSubsource,
    );

    const sourceHostname = resolveSourceHostname(extracted.canonicalUrl ?? extracted.finalUrl ?? normalizedUrl);
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
      contentOriginKey: derivedContentOrigin.key,
      contentOriginLabel: derivedContentOrigin.label,
      title: extracted.title,
      sourceUrl: normalizedUrl,
      canonicalUrl: extracted.canonicalUrl ?? extracted.finalUrl,
      dedupeKey: finalDedupeKey || dedupeKey,
      lang: extracted.lang,
      excerpt: extracted.excerpt,
      author: extracted.author,
      publishedAt: extracted.publishedAt,
      publishedAtKind: extracted.publishedAt ? PublishedAtKind.EXACT : PublishedAtKind.UNKNOWN,
      ingestionStatus: IngestionStatus.READY,
      contentHtml: extracted.contentHtml,
      plainText: extracted.plainText,
      rawHtml: extracted.rawHtml,
      textHash: extracted.textHash,
      wordCount: extracted.wordCount,
      extractedAt: new Date(),
    });

    if (extracted.publishedAt && sourceHostname) {
      await backfillHostnamePublishedAtUpperBound({
        hostname: sourceHostname,
        anchorCreatedAt: document.createdAt,
        upperBoundPublishedAt: extracted.publishedAt,
      });
    }

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

export function normalizeCaptureInputUrl(inputUrl: string) {
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
    dedupeKey: generateDedupeKey({ type: "WEB_PAGE", sourceUrl }),
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

function resolveSourceHostname(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
}

function needsVideoTranscriptRefresh(document: DocumentDetailRecord) {
  if (!document.videoProvider || !document.videoUrl) {
    return true;
  }

  if (countTranscriptSegments(document.transcriptSegments) === 0) {
    return true;
  }

  const plainText = document.content?.plainText ?? "";
  return !plainText.trim();
}

function countTranscriptSegments(value: unknown) {
  if (!Array.isArray(value)) {
    return 0;
  }

  return value.filter((item) => item && typeof item === "object" && !Array.isArray(item)).length;
}

async function refreshVideoDocumentFromCapture(documentId: string, sourceUrl: string, capturedVideo: CapturedVideoDocument) {
  return refreshVideoWebDocument(documentId, {
    title: capturedVideo.title,
    sourceUrl,
    canonicalUrl: capturedVideo.canonicalUrl,
    externalId: capturedVideo.externalId,
    lang: capturedVideo.lang,
    excerpt: capturedVideo.excerpt,
    author: capturedVideo.author,
    videoUrl: capturedVideo.videoUrl,
    videoProvider: capturedVideo.provider,
    videoThumbnailUrl: capturedVideo.videoThumbnailUrl,
    videoDurationSeconds: capturedVideo.videoDurationSeconds,
    transcriptSegments: capturedVideo.transcriptSegments,
    publishedAt: capturedVideo.publishedAt,
    publishedAtKind: capturedVideo.publishedAt ? PublishedAtKind.EXACT : PublishedAtKind.UNKNOWN,
    ingestionStatus: IngestionStatus.READY,
    plainText: capturedVideo.plainText,
    textHash: capturedVideo.textHash,
    wordCount: capturedVideo.wordCount,
    extractedAt: new Date(),
  });
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
  return findLatestCaptureErrorForDocument(document);
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
