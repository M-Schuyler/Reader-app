import { IngestionStatus, type AiSummaryStatus } from "@prisma/client";
import type { PrioritizeDocumentAiSummaryResponseData } from "@/server/modules/documents/document.types";

const DEFAULT_DOCUMENT_AI_SUMMARY_RETRY_DELAY_MS = 3_000;

type DocumentAiSummaryPriorityCandidate = {
  ingestionStatus: IngestionStatus;
  aiSummary: string | null;
  aiSummaryStatus: AiSummaryStatus | null;
  excerpt: string | null;
  content: {
    plainText: string;
  } | null;
};

export function shouldAutoPrioritizeDocumentAiSummary(document: DocumentAiSummaryPriorityCandidate) {
  if (document.ingestionStatus !== IngestionStatus.READY) {
    return false;
  }

  if (normalizeText(document.aiSummary)) {
    return false;
  }

  return Boolean(normalizeText(document.content?.plainText) || normalizeText(document.excerpt));
}

export function resolveDocumentAiSummaryPriorityRetryDelay(
  summary: PrioritizeDocumentAiSummaryResponseData["summary"],
) {
  if (summary.status !== "queued") {
    return null;
  }

  return Math.max(summary.throttle?.retryAfterMs ?? DEFAULT_DOCUMENT_AI_SUMMARY_RETRY_DELAY_MS, 1_000);
}

function normalizeText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}
