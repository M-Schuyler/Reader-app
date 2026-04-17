import {
  IngestionJobKind,
  IngestionJobStatus,
  TranscriptSource,
  TranscriptStatus,
  type Prisma,
} from "@prisma/client";
import { prisma } from "@/server/db/client";
import { documentDetailArgs, type DocumentDetailRecord } from "./document.repository";
import { generateGeminiTranscript } from "./gemini-transcript.service";

const TRANSCRIPT_PROVIDER_LOCK_NAMESPACE = 41_022;
const TRANSCRIPT_JOB_BATCH_SIZE = 5;

export async function hydrateDocumentTranscriptIfPossible(document: DocumentDetailRecord) {
  if (document.transcriptStatus !== TranscriptStatus.PENDING) {
    return document;
  }

  const existingJob = await prisma.ingestionJob.findFirst({
    where: {
      kind: IngestionJobKind.GENERATE_TRANSCRIPT,
      documentId: document.id,
      status: {
        in: [IngestionJobStatus.PENDING, IngestionJobStatus.PROCESSING],
      },
    },
  });

  if (!existingJob) {
    await prisma.ingestionJob.create({
      data: {
        kind: IngestionJobKind.GENERATE_TRANSCRIPT,
        status: IngestionJobStatus.PENDING,
        documentId: document.id,
        sourceUrl: document.sourceUrl ?? document.canonicalUrl,
      },
    });
  }

  return document;
}

export async function runPendingDocumentTranscriptJobs(limit = TRANSCRIPT_JOB_BATCH_SIZE) {
  const jobs = await prisma.ingestionJob.findMany({
    where: {
      kind: IngestionJobKind.GENERATE_TRANSCRIPT,
      status: IngestionJobStatus.PENDING,
    },
    orderBy: {
      createdAt: "asc",
    },
    take: limit,
  });

  const results = [];
  for (const job of jobs) {
    results.push(await processTranscriptJob(job));
  }

  return {
    processed: jobs.length,
    results,
  };
}

async function processTranscriptJob(job: Prisma.IngestionJobGetPayload<Record<string, never>>) {
  const claimedJob = await prisma.ingestionJob.updateMany({
    where: {
      id: job.id,
      status: IngestionJobStatus.PENDING,
    },
    data: {
      status: IngestionJobStatus.PROCESSING,
      startedAt: new Date(),
    },
  });

  if (claimedJob.count === 0) {
    return { jobId: job.id, outcome: "skipped" };
  }

  if (!job.documentId) {
    return failTranscriptJob(job.id, "Missing documentId");
  }

  const document = await prisma.document.findUnique({
    where: { id: job.documentId },
    ...documentDetailArgs,
  });

  if (!document) {
    return failTranscriptJob(job.id, "Document not found");
  }

  if (document.transcriptSegments && Array.isArray(document.transcriptSegments) && document.transcriptSegments.length > 0) {
    await prisma.ingestionJob.update({
      where: { id: job.id },
      data: {
        status: IngestionJobStatus.SUCCEEDED,
        finishedAt: new Date(),
        payloadJson: { outcome: "skipped", reason: "already_has_transcript" },
      },
    });
    return { jobId: job.id, outcome: "skipped" };
  }

  const videoUrl = document.videoUrl ?? document.canonicalUrl ?? document.sourceUrl;
  if (!videoUrl) {
    return failTranscriptJob(job.id, "No video URL available");
  }

  try {
    const result = await generateGeminiTranscript(videoUrl, document.title);
    
    await prisma.document.update({
      where: { id: document.id },
      data: {
        transcriptSegments: result.segments as any,
        transcriptSource: TranscriptSource.GEMINI,
        transcriptStatus: result.segments.length > 0 ? TranscriptStatus.READY : TranscriptStatus.FAILED,
        lang: result.language || document.lang,
      },
    });

    await prisma.ingestionJob.update({
      where: { id: job.id },
      data: {
        status: IngestionJobStatus.SUCCEEDED,
        finishedAt: new Date(),
        payloadJson: {
          outcome: "generated",
          segmentCount: result.segments.length,
          language: result.language,
        },
      },
    });

    return { jobId: job.id, outcome: "generated" };
  } catch (error: any) {
    console.error("Transcript job failed:", error);
    
    await prisma.document.update({
      where: { id: document.id },
      data: {
        transcriptStatus: TranscriptStatus.FAILED,
      },
    });

    return failTranscriptJob(job.id, error.message || "Gemini transcript generation failed");
  }
}

async function failTranscriptJob(jobId: string, message: string) {
  await prisma.ingestionJob.update({
    where: { id: jobId },
    data: {
      status: IngestionJobStatus.FAILED,
      errorMessage: message,
      finishedAt: new Date(),
    },
  });
  return { jobId, outcome: "failed", error: message };
}

export async function sweepPendingDocumentTranscriptJobs() {
  // Simple sweep for v1
  return runPendingDocumentTranscriptJobs();
}
