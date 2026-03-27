import {
  AiSummaryStatus,
  IngestionJobKind,
  IngestionJobStatus,
  IngestionStatus,
  type Prisma,
} from "@prisma/client";
import { RouteError } from "@/server/api/response";
import { prisma } from "@/server/db/client";
import { generateDocumentAiSummary } from "./document-ai-summary.service";
import {
  documentDetailArgs,
  getDocumentById,
  type DocumentDetailRecord,
  updateDocumentAiSummary,
  updateDocumentAiSummaryFailure,
  updateDocumentAiSummaryState,
} from "./document.repository";
import type {
  GenerateAiSummaryError,
  RunDocumentAiSummaryJobsResponseData,
} from "./document.types";

const DEFAULT_SUMMARY_JOB_BATCH_SIZE = 5;
const MAX_SUMMARY_JOB_BATCH_SIZE = 20;

type AutoAiSummaryCandidate = {
  ingestionStatus: IngestionStatus;
  aiSummary: string | null;
  aiSummaryStatus: AiSummaryStatus | null;
  excerpt: string | null;
  content: {
    plainText: string;
  } | null;
};

type SummaryJobResult = RunDocumentAiSummaryJobsResponseData["results"][number];

export function getSummaryRuntimeIssues(options?: { requireInternalApiSecret?: boolean }) {
  const issues: string[] = [];
  const requireInternalApiSecret = options?.requireInternalApiSecret ?? true;
  const provider = normalizeAiProvider(process.env.AI_PROVIDER);

  if (!provider) {
    issues.push('AI_PROVIDER is not supported. Expected "gemini" or "openai".');
  } else if (provider === "gemini" && !process.env.GEMINI_API_KEY?.trim()) {
    issues.push("GEMINI_API_KEY is not configured.");
  } else if (provider === "openai" && !process.env.OPENAI_API_KEY?.trim()) {
    issues.push("OPENAI_API_KEY is not configured.");
  }

  if (requireInternalApiSecret && !process.env.INTERNAL_API_SECRET?.trim()) {
    issues.push("INTERNAL_API_SECRET is not configured.");
  }

  return issues;
}

export function shouldEnqueueAutomaticAiSummary(document: AutoAiSummaryCandidate) {
  if (document.ingestionStatus !== IngestionStatus.READY) {
    return false;
  }

  if (document.aiSummary || document.aiSummaryStatus) {
    return false;
  }

  return Boolean(normalizeSummarySourceText(document.content?.plainText) || normalizeSummarySourceText(document.excerpt));
}

export async function queueAutomaticDocumentAiSummary(document: DocumentDetailRecord) {
  if (!shouldEnqueueAutomaticAiSummary(document)) {
    return document;
  }

  const existingJob = await prisma.ingestionJob.findFirst({
    where: {
      kind: IngestionJobKind.GENERATE_AI_SUMMARY,
      documentId: document.id,
      status: {
        in: [IngestionJobStatus.PENDING, IngestionJobStatus.PROCESSING],
      },
    },
  });

  if (existingJob) {
    return document.aiSummaryStatus === AiSummaryStatus.PENDING
      ? document
      : updateDocumentAiSummaryState(document.id, AiSummaryStatus.PENDING);
  }

  if (document.aiSummaryStatus === AiSummaryStatus.PENDING) {
    await prisma.ingestionJob.create({
      data: {
        kind: IngestionJobKind.GENERATE_AI_SUMMARY,
        status: IngestionJobStatus.PENDING,
        documentId: document.id,
        sourceUrl: document.sourceUrl ?? document.canonicalUrl,
      },
    });

    return document;
  }

  const [pendingDocument] = await prisma.$transaction([
    prisma.document.update({
      where: { id: document.id },
      data: {
        aiSummaryStatus: AiSummaryStatus.PENDING,
        aiSummaryError: null,
      },
      ...documentDetailArgs,
    }),
    prisma.ingestionJob.create({
      data: {
        kind: IngestionJobKind.GENERATE_AI_SUMMARY,
        status: IngestionJobStatus.PENDING,
        documentId: document.id,
        sourceUrl: document.sourceUrl ?? document.canonicalUrl,
      },
    }),
  ]);

  return pendingDocument;
}

export async function queueAndRunAutomaticDocumentAiSummary(document: DocumentDetailRecord) {
  const queuedDocument = await queueAutomaticDocumentAiSummary(document);

  if (getSummaryRuntimeIssues({ requireInternalApiSecret: false }).length > 0) {
    return queuedDocument;
  }

  return (await runPendingDocumentAiSummaryForDocument(queuedDocument.id)) ?? queuedDocument;
}

export async function runPendingDocumentAiSummaryJobs(limitInput?: number): Promise<RunDocumentAiSummaryJobsResponseData> {
  const jobs = await prisma.ingestionJob.findMany({
    where: {
      kind: IngestionJobKind.GENERATE_AI_SUMMARY,
      status: IngestionJobStatus.PENDING,
    },
    orderBy: {
      createdAt: "asc",
    },
    take: normalizeSummaryJobBatchLimit(limitInput),
  });

  const results: SummaryJobResult[] = [];

  for (const job of jobs) {
    results.push(await processSummaryJob(job));
  }

  return {
    processed: results.length,
    generated: results.filter((result) => result.outcome === "generated").length,
    failed: results.filter((result) => result.outcome === "failed").length,
    skipped: results.filter((result) => result.outcome === "skipped").length,
    results,
  };
}

function normalizeSummaryJobBatchLimit(value?: number) {
  if (!Number.isFinite(value)) {
    return DEFAULT_SUMMARY_JOB_BATCH_SIZE;
  }

  const normalized = Math.trunc(value as number);
  if (normalized < 1) {
    throw new RouteError("INVALID_QUERY", 400, '"limit" must be a positive integer.');
  }

  return Math.min(normalized, MAX_SUMMARY_JOB_BATCH_SIZE);
}

function normalizeAiProvider(value: string | undefined) {
  const normalized = value?.trim().toLowerCase() ?? "gemini";
  if (normalized === "gemini" || normalized === "openai") {
    return normalized;
  }

  return null;
}

async function processSummaryJob(job: Prisma.IngestionJobGetPayload<Record<string, never>>): Promise<SummaryJobResult> {
  await prisma.ingestionJob.update({
    where: { id: job.id },
    data: {
      status: IngestionJobStatus.PROCESSING,
      startedAt: job.startedAt ?? new Date(),
      errorMessage: null,
    },
  });

  if (!job.documentId) {
    return failSummaryJob(job.id, null, {
      code: "DOCUMENT_NOT_FOUND",
      message: "Summary job is missing its document reference.",
    });
  }

  const document = await getDocumentById(job.documentId);
  if (!document) {
    return failSummaryJob(job.id, job.documentId, {
      code: "DOCUMENT_NOT_FOUND",
      message: "Document was not found.",
    });
  }

  if (document.aiSummary) {
    await prisma.ingestionJob.update({
      where: { id: job.id },
      data: {
        status: IngestionJobStatus.SUCCEEDED,
        finishedAt: new Date(),
        payloadJson: {
          outcome: "skipped",
          reason: "already_summarized",
        },
      },
    });

    return {
      jobId: job.id,
      documentId: document.id,
      outcome: "skipped",
      error: null,
    };
  }

  if (!isEligibleQueuedDocument(document)) {
    const error = {
      code: "DOCUMENT_NOT_READY_FOR_AI_SUMMARY",
      message: "Document is not eligible for automatic AI summary generation.",
    } satisfies GenerateAiSummaryError;

    if (document.aiSummaryStatus === AiSummaryStatus.PENDING) {
      await updateDocumentAiSummaryFailure(document.id, error.message);
    }

    return failSummaryJob(job.id, document.id, error);
  }

  try {
    const generated = await generateDocumentAiSummary(document);
    await updateDocumentAiSummary(document.id, generated.summary);
    await prisma.ingestionJob.update({
      where: { id: job.id },
      data: {
        status: IngestionJobStatus.SUCCEEDED,
        finishedAt: new Date(),
        payloadJson: {
          outcome: "generated",
          source: generated.source,
        },
      },
    });

    return {
      jobId: job.id,
      documentId: document.id,
      outcome: "generated",
      error: null,
    };
  } catch (error) {
    const summaryError = toGenerateAiSummaryError(error);
    await updateDocumentAiSummaryFailure(document.id, summaryError.message);
    return failSummaryJob(job.id, document.id, summaryError);
  }
}

async function runPendingDocumentAiSummaryForDocument(documentId: string) {
  const pendingJob = await prisma.ingestionJob.findFirst({
    where: {
      kind: IngestionJobKind.GENERATE_AI_SUMMARY,
      documentId,
      status: IngestionJobStatus.PENDING,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  if (!pendingJob) {
    return getDocumentById(documentId);
  }

  await processSummaryJob(pendingJob);
  return getDocumentById(documentId);
}

function isEligibleQueuedDocument(document: DocumentDetailRecord) {
  if (document.ingestionStatus !== IngestionStatus.READY) {
    return false;
  }

  return Boolean(normalizeSummarySourceText(document.content?.plainText) || normalizeSummarySourceText(document.excerpt));
}

function normalizeSummarySourceText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

async function failSummaryJob(jobId: string, documentId: string | null, error: GenerateAiSummaryError): Promise<SummaryJobResult> {
  await prisma.ingestionJob.update({
    where: { id: jobId },
    data: {
      status: IngestionJobStatus.FAILED,
      errorMessage: error.message,
      payloadJson: {
        outcome: "failed",
        error,
      },
      finishedAt: new Date(),
    },
  });

  return {
    jobId,
    documentId,
    outcome: "failed",
    error,
  };
}

function toGenerateAiSummaryError(error: unknown): GenerateAiSummaryError {
  if (error instanceof RouteError) {
    return {
      code: error.code,
      message: error.message,
    };
  }

  if (error instanceof Error && error.message) {
    return {
      code: "AI_SUMMARY_FAILED",
      message: error.message,
    };
  }

  return {
    code: "AI_SUMMARY_FAILED",
    message: "AI summary generation failed.",
  };
}
