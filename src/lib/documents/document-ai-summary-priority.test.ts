import assert from "node:assert/strict";
import test from "node:test";
import { AiSummaryStatus, IngestionStatus } from "@prisma/client";
import {
  resolveDocumentAiSummaryPriorityRetryDelay,
  shouldAutoPrioritizeDocumentAiSummary,
} from "@/lib/documents/document-ai-summary-priority";

test("shouldAutoPrioritizeDocumentAiSummary allows the open document to request a summary while it is still pending", () => {
  assert.equal(
    shouldAutoPrioritizeDocumentAiSummary({
      ingestionStatus: IngestionStatus.READY,
      aiSummary: null,
      aiSummaryStatus: AiSummaryStatus.PENDING,
      excerpt: "一段导语。",
      content: {
        plainText: "一段正文。",
      },
    }),
    true,
  );
});

test("shouldAutoPrioritizeDocumentAiSummary skips documents that are already summarized or unreadable", () => {
  assert.equal(
    shouldAutoPrioritizeDocumentAiSummary({
      ingestionStatus: IngestionStatus.READY,
      aiSummary: "现成摘要",
      aiSummaryStatus: AiSummaryStatus.READY,
      excerpt: "一段导语。",
      content: {
        plainText: "一段正文。",
      },
    }),
    false,
  );

  assert.equal(
    shouldAutoPrioritizeDocumentAiSummary({
      ingestionStatus: IngestionStatus.FAILED,
      aiSummary: null,
      aiSummaryStatus: null,
      excerpt: "一段导语。",
      content: {
        plainText: "一段正文。",
      },
    }),
    false,
  );
});

test("resolveDocumentAiSummaryPriorityRetryDelay respects throttle windows and falls back to a short poll", () => {
  assert.equal(
    resolveDocumentAiSummaryPriorityRetryDelay({
      status: "queued",
      error: null,
      throttle: {
        reason: "rate_limited",
        retryAfterMs: 12_000,
        cooldownUntil: "2026-04-07T08:12:00.000Z",
      },
      runtimeIssues: [],
    }),
    12_000,
  );

  assert.equal(
    resolveDocumentAiSummaryPriorityRetryDelay({
      status: "queued",
      error: null,
      throttle: null,
      runtimeIssues: [],
    }),
    3_000,
  );

  assert.equal(
    resolveDocumentAiSummaryPriorityRetryDelay({
      status: "generated",
      error: null,
      throttle: null,
      runtimeIssues: [],
    }),
    null,
  );
});
