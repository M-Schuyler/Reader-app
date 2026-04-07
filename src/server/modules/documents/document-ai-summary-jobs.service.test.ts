import assert from "node:assert/strict";
import test from "node:test";
import { AiSummaryStatus, IngestionStatus } from "@prisma/client";
import {
  calculateNextSummaryRateLimitDelayMs,
  getSummaryRuntimeIssues,
  prioritizeDocumentAiSummary,
  runPendingDocumentAiSummaryJobs,
  sweepPendingDocumentAiSummaryJobs,
  shouldBackfillAutomaticAiSummary,
  shouldEnqueueAutomaticAiSummary,
} from "@/server/modules/documents/document-ai-summary-jobs.service";
import type { DocumentDetailRecord } from "@/server/modules/documents/document.repository";

test("queues auto summary for ready documents with extracted body text", () => {
  assert.equal(
    shouldEnqueueAutomaticAiSummary({
      ingestionStatus: IngestionStatus.READY,
      aiSummary: null,
      aiSummaryStatus: null,
      excerpt: "A short excerpt.",
      content: {
        plainText: "A full body of text that can be summarized.",
      },
    }),
    true,
  );
});

test("queues auto summary for ready documents with excerpt fallback only", () => {
  assert.equal(
    shouldEnqueueAutomaticAiSummary({
      ingestionStatus: IngestionStatus.READY,
      aiSummary: null,
      aiSummaryStatus: null,
      excerpt: "A short excerpt.",
      content: null,
    }),
    true,
  );
});

test("does not queue auto summary for failed, already summarized, or previously attempted documents", () => {
  assert.equal(
    shouldEnqueueAutomaticAiSummary({
      ingestionStatus: IngestionStatus.FAILED,
      aiSummary: null,
      aiSummaryStatus: null,
      excerpt: "A short excerpt.",
      content: {
        plainText: "A full body of text that can be summarized.",
      },
    }),
    false,
  );

  assert.equal(
    shouldEnqueueAutomaticAiSummary({
      ingestionStatus: IngestionStatus.READY,
      aiSummary: "Already summarized.",
      aiSummaryStatus: AiSummaryStatus.READY,
      excerpt: "A short excerpt.",
      content: {
        plainText: "A full body of text that can be summarized.",
      },
    }),
    false,
  );

  assert.equal(
    shouldEnqueueAutomaticAiSummary({
      ingestionStatus: IngestionStatus.READY,
      aiSummary: null,
      aiSummaryStatus: AiSummaryStatus.FAILED,
      excerpt: "A short excerpt.",
      content: {
        plainText: "A full body of text that can be summarized.",
      },
    }),
    false,
  );

  assert.equal(
    shouldEnqueueAutomaticAiSummary({
      ingestionStatus: IngestionStatus.READY,
      aiSummary: null,
      aiSummaryStatus: AiSummaryStatus.PENDING,
      excerpt: "A short excerpt.",
      content: {
        plainText: "A full body of text that can be summarized.",
      },
    }),
    false,
  );
});

test("does not queue auto summary when both plain text and excerpt are missing", () => {
  assert.equal(
    shouldEnqueueAutomaticAiSummary({
      ingestionStatus: IngestionStatus.READY,
      aiSummary: null,
      aiSummaryStatus: null,
      excerpt: null,
      content: {
        plainText: "   ",
      },
    }),
    false,
  );
});

test("backfill includes ready unsummarized documents with summary source text", () => {
  assert.equal(
    shouldBackfillAutomaticAiSummary({
      ingestionStatus: IngestionStatus.READY,
      aiSummary: null,
      aiSummaryStatus: null,
      excerpt: "A short excerpt.",
      content: {
        plainText: "A full body of text that can be summarized.",
      },
    }),
    true,
  );
});

test("backfill includes previously failed summaries when the document is still eligible", () => {
  assert.equal(
    shouldBackfillAutomaticAiSummary({
      ingestionStatus: IngestionStatus.READY,
      aiSummary: null,
      aiSummaryStatus: AiSummaryStatus.FAILED,
      excerpt: "A short excerpt.",
      content: {
        plainText: "A full body of text that can be summarized.",
      },
    }),
    true,
  );
});

test("backfill excludes pending, failed-ingestion, or already summarized documents", () => {
  assert.equal(
    shouldBackfillAutomaticAiSummary({
      ingestionStatus: IngestionStatus.READY,
      aiSummary: null,
      aiSummaryStatus: AiSummaryStatus.PENDING,
      excerpt: "A short excerpt.",
      content: {
        plainText: "A full body of text that can be summarized.",
      },
    }),
    false,
  );

  assert.equal(
    shouldBackfillAutomaticAiSummary({
      ingestionStatus: IngestionStatus.FAILED,
      aiSummary: null,
      aiSummaryStatus: AiSummaryStatus.FAILED,
      excerpt: "A short excerpt.",
      content: {
        plainText: "A full body of text that can be summarized.",
      },
    }),
    false,
  );

  assert.equal(
    shouldBackfillAutomaticAiSummary({
      ingestionStatus: IngestionStatus.READY,
      aiSummary: "Already summarized.",
      aiSummaryStatus: AiSummaryStatus.READY,
      excerpt: "A short excerpt.",
      content: {
        plainText: "A full body of text that can be summarized.",
      },
    }),
    false,
  );
});

test("allows direct summary generation without INTERNAL_API_SECRET when provider config is present", () => {
  const previousEnv = {
    AI_PROVIDER: process.env.AI_PROVIDER,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    INTERNAL_API_SECRET: process.env.INTERNAL_API_SECRET,
  };

  process.env.AI_PROVIDER = "gemini";
  process.env.GEMINI_API_KEY = "test-gemini-key";
  delete process.env.OPENAI_API_KEY;
  delete process.env.INTERNAL_API_SECRET;

  try {
    assert.deepEqual(getSummaryRuntimeIssues({ requireInternalApiSecret: false }), []);
  } finally {
    restoreEnv(previousEnv);
  }
});

test("summary runtime accepts CRON_SECRET when INTERNAL_API_SECRET is absent", () => {
  const previousEnv = {
    AI_PROVIDER: process.env.AI_PROVIDER,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    INTERNAL_API_SECRET: process.env.INTERNAL_API_SECRET,
    CRON_SECRET: process.env.CRON_SECRET,
  };

  process.env.AI_PROVIDER = "gemini";
  process.env.GEMINI_API_KEY = "test-gemini-key";
  delete process.env.OPENAI_API_KEY;
  delete process.env.INTERNAL_API_SECRET;
  process.env.CRON_SECRET = "test-cron-secret";

  try {
    assert.deepEqual(getSummaryRuntimeIssues(), []);
  } finally {
    restoreEnv(previousEnv);
  }
});

test("calculateNextSummaryRateLimitDelayMs exponentially backs off when provider omits retry-after", () => {
  const first = calculateNextSummaryRateLimitDelayMs(
    {
      cooldownUntil: null,
      lastCooldownMs: 0,
      consecutiveRateLimitCount: 0,
    },
    {},
    { random: () => 0 },
  );
  const second = calculateNextSummaryRateLimitDelayMs(
    {
      cooldownUntil: null,
      lastCooldownMs: first,
      consecutiveRateLimitCount: 1,
    },
    {},
    { random: () => 0 },
  );

  assert.equal(first, 15_000);
  assert.equal(second, 30_000);
});

test("runPendingDocumentAiSummaryJobs returns runner_busy when another instance holds the provider lock", async () => {
  const response = await runPendingDocumentAiSummaryJobs(5, {
    random: () => 0,
    runNextJob: async () => ({
      result: null,
      throttle: {
        reason: "runner_busy",
        retryAfterMs: 1_500,
        cooldownUntil: null,
      },
    }),
  });

  assert.equal(response.processed, 0);
  assert.equal(response.generated, 0);
  assert.equal(response.failed, 0);
  assert.equal(response.skipped, 0);
  assert.equal(response.deferred, 0);
  assert.equal(response.throttle?.reason, "runner_busy");
  assert.equal(response.throttle?.retryAfterMs, 1_500);
  assert.equal(response.throttle?.cooldownUntil, null);
});

test("runPendingDocumentAiSummaryJobs leaves a fairness gap between successful jobs", async () => {
  const sleeps: number[] = [];
  const runs = [
    {
      result: {
        jobId: "job-1",
        documentId: "doc-1",
        outcome: "generated" as const,
        error: null,
      },
      throttle: null,
    },
    {
      result: {
        jobId: "job-2",
        documentId: "doc-2",
        outcome: "skipped" as const,
        error: null,
      },
      throttle: null,
    },
    {
      result: null,
      throttle: null,
    },
  ];

  const response = await runPendingDocumentAiSummaryJobs(5, {
    random: () => 0,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
    runNextJob: async () => runs.shift()!,
  });

  assert.deepEqual(sleeps, [150, 150]);
  assert.equal(response.processed, 2);
  assert.equal(response.generated, 1);
  assert.equal(response.skipped, 1);
  assert.equal(response.throttle, null);
});

test("prioritizeDocumentAiSummary queues the current document but respects an active cooldown", async () => {
  const existingDocument = createSummaryDocumentRecord({
    aiSummaryStatus: null,
  });

  const response = await prioritizeDocumentAiSummary(existingDocument.id, {
    getDocument: async () => existingDocument,
    getRuntimeIssues: () => [],
    withLock: async () => ({
      status: "acquired",
      value: {
        document: {
          ...existingDocument,
          aiSummaryStatus: AiSummaryStatus.PENDING,
        },
        summary: {
          status: "queued",
          error: null,
          throttle: {
            reason: "rate_limited",
            retryAfterMs: 15_000,
            cooldownUntil: new Date(30_000).toISOString(),
          },
          runtimeIssues: [],
        },
      },
    }),
  });

  assert.equal(response?.summary.status, "queued");
  assert.equal(response?.summary.runtimeIssues.length, 0);
  assert.equal(response?.summary.throttle?.retryAfterMs, 15_000);
  assert.equal(response?.summary.throttle?.cooldownUntil, new Date(30_000).toISOString());
  assert.equal(response?.document.aiSummaryStatus, AiSummaryStatus.PENDING);
});

test("prioritizeDocumentAiSummary generates a summary for the open document immediately when possible", async () => {
  const existingDocument = createSummaryDocumentRecord({
    aiSummaryStatus: null,
  });
  const summarizedDocument = createSummaryDocumentRecord({
    id: existingDocument.id,
    aiSummary: "这篇文章在提醒人们，AI 工具热闹归热闹，但真正稀缺的是被规训生活掩埋后的个人创造力。",
    aiSummaryStatus: AiSummaryStatus.READY,
  });

  const response = await prioritizeDocumentAiSummary(existingDocument.id, {
    getDocument: async () => existingDocument,
    getRuntimeIssues: () => [],
    withLock: async () => ({
      status: "acquired",
      value: {
        document: summarizedDocument,
        summary: {
          status: "generated",
          error: null,
          throttle: null,
          runtimeIssues: [],
        },
      },
    }),
  });

  assert.equal(response?.summary.status, "generated");
  assert.equal(response?.summary.error, null);
  assert.equal(response?.summary.throttle, null);
  assert.equal(response?.document.aiSummary, summarizedDocument.aiSummary);
  assert.equal(response?.document.aiSummaryStatus, AiSummaryStatus.READY);
});

test("prioritizeDocumentAiSummary does not fake a pending state when runtime configuration is missing", async () => {
  const existingDocument = createSummaryDocumentRecord({
    aiSummaryStatus: null,
  });
  let queueCalls = 0;

  const response = await prioritizeDocumentAiSummary(existingDocument.id, {
    getDocument: async () => existingDocument,
    getRuntimeIssues: () => ["GEMINI_API_KEY is not configured."],
    ensurePendingDocument: async (document) => {
      queueCalls += 1;
      return document;
    },
  });

  assert.equal(queueCalls, 0);
  assert.equal(response?.summary.status, "blocked");
  assert.deepEqual(response?.summary.runtimeIssues, ["GEMINI_API_KEY is not configured."]);
  assert.equal(response?.document.aiSummaryStatus, null);
});

test("prioritizeDocumentAiSummary returns a queued response and activates cooldown after rate limiting the open document", async () => {
  const existingDocument = createSummaryDocumentRecord({
    aiSummaryStatus: AiSummaryStatus.PENDING,
  });

  const response = await prioritizeDocumentAiSummary(existingDocument.id, {
    getDocument: async () => existingDocument,
    getRuntimeIssues: () => [],
    withLock: async () => ({
      status: "acquired",
      value: {
        document: existingDocument,
        summary: {
          status: "queued",
          error: {
            code: "AI_PROVIDER_RATE_LIMITED",
            message: "AI 服务请求过于频繁，请稍后重试。",
            retryAfterMs: 12_000,
          },
          throttle: {
            reason: "rate_limited",
            retryAfterMs: 12_000,
            cooldownUntil: new Date(17_000).toISOString(),
          },
          runtimeIssues: [],
        },
      },
    }),
  });

  assert.equal(response?.summary.status, "queued");
  assert.equal(response?.summary.error?.code, "AI_PROVIDER_RATE_LIMITED");
  assert.equal(response?.summary.throttle?.retryAfterMs, 12_000);
  assert.equal(response?.summary.throttle?.cooldownUntil, new Date(17_000).toISOString());
});

test("prioritizeDocumentAiSummary returns queued runner_busy when another instance holds the provider lock", async () => {
  const existingDocument = createSummaryDocumentRecord({
    aiSummaryStatus: null,
  });

  const response = await prioritizeDocumentAiSummary(existingDocument.id, {
    getDocument: async () => existingDocument,
    getRuntimeIssues: () => [],
    random: () => 0,
    withLock: async () => ({
      status: "runner_busy",
    }),
  });

  assert.equal(response?.summary.status, "queued");
  assert.equal(response?.summary.error, null);
  assert.equal(response?.summary.throttle?.reason, "runner_busy");
  assert.equal(response?.summary.throttle?.retryAfterMs, 1_500);
  assert.equal(response?.summary.throttle?.cooldownUntil, null);
});

test("prioritizeDocumentAiSummary skips immediately when the current document was already summarized before its turn", async () => {
  const existingDocument = createSummaryDocumentRecord({
    aiSummary: "已经有摘要了。",
    aiSummaryStatus: AiSummaryStatus.READY,
  });

  const response = await prioritizeDocumentAiSummary(existingDocument.id, {
    getDocument: async () => existingDocument,
    getRuntimeIssues: () => [],
    withLock: async () => ({
      status: "acquired",
      value: {
        document: existingDocument,
        summary: {
          status: "skipped",
          error: null,
          throttle: null,
          runtimeIssues: [],
        },
      },
    }),
  });

  assert.equal(response?.summary.status, "skipped");
  assert.equal(response?.document.aiSummary, "已经有摘要了。");
});

test("sweepPendingDocumentAiSummaryJobs waits through a rate-limit window and resumes when budget allows", async () => {
  let nowMs = 1_000;
  const sleeps: number[] = [];
  const responses = [
    {
      processed: 1,
      generated: 0,
      failed: 0,
      skipped: 0,
      deferred: 1,
      throttle: {
        reason: "rate_limited" as const,
        retryAfterMs: 4_000,
        cooldownUntil: new Date(5_000).toISOString(),
      },
      results: [],
    },
    {
      processed: 2,
      generated: 2,
      failed: 0,
      skipped: 0,
      deferred: 0,
      throttle: null,
      results: [],
    },
    {
      processed: 0,
      generated: 0,
      failed: 0,
      skipped: 0,
      deferred: 0,
      throttle: null,
      results: [],
    },
  ];

  const response = await sweepPendingDocumentAiSummaryJobs(
    {
      limit: 5,
      maxRuns: 4,
      maxRuntimeMs: 15_000,
    },
    {
      now: () => nowMs,
      sleep: async (ms) => {
        sleeps.push(ms);
        nowMs += ms;
      },
      runBatch: async () => responses.shift()!,
    },
  );

  assert.deepEqual(sleeps, [4_000]);
  assert.equal(response.runs, 3);
  assert.equal(response.processed, 3);
  assert.equal(response.generated, 2);
  assert.equal(response.failed, 0);
  assert.equal(response.skipped, 0);
  assert.equal(response.deferred, 1);
  assert.equal(response.waitedMs, 4_000);
  assert.equal(response.completed, true);
  assert.equal(response.stopReason, "queue_empty");
  assert.equal(response.throttle, null);
});

test("sweepPendingDocumentAiSummaryJobs stops before sleeping when the throttle window would exhaust the runtime budget", async () => {
  let nowMs = 1_000;
  const sleeps: number[] = [];

  const response = await sweepPendingDocumentAiSummaryJobs(
    {
      limit: 5,
      maxRuns: 4,
      maxRuntimeMs: 10_000,
    },
    {
      now: () => nowMs,
      sleep: async (ms) => {
        sleeps.push(ms);
        nowMs += ms;
      },
      runBatch: async () => ({
        processed: 1,
        generated: 0,
        failed: 0,
        skipped: 0,
        deferred: 1,
        throttle: {
          reason: "rate_limited" as const,
          retryAfterMs: 12_000,
          cooldownUntil: new Date(13_000).toISOString(),
        },
        results: [],
      }),
    },
  );

  assert.deepEqual(sleeps, []);
  assert.equal(response.runs, 1);
  assert.equal(response.processed, 1);
  assert.equal(response.generated, 0);
  assert.equal(response.failed, 0);
  assert.equal(response.skipped, 0);
  assert.equal(response.deferred, 1);
  assert.equal(response.waitedMs, 0);
  assert.equal(response.completed, false);
  assert.equal(response.stopReason, "time_budget_exhausted");
  assert.equal(response.throttle?.retryAfterMs, 12_000);
});

test("sweepPendingDocumentAiSummaryJobs returns runner_busy when the sweep budget would be burned waiting for another instance", async () => {
  let nowMs = 1_000;
  const sleeps: number[] = [];

  const response = await sweepPendingDocumentAiSummaryJobs(
    {
      limit: 5,
      maxRuns: 4,
      maxRuntimeMs: 2_000,
    },
    {
      now: () => nowMs,
      sleep: async (ms) => {
        sleeps.push(ms);
        nowMs += ms;
      },
      runBatch: async () => ({
        processed: 0,
        generated: 0,
        failed: 0,
        skipped: 0,
        deferred: 0,
        throttle: {
          reason: "runner_busy" as const,
          retryAfterMs: 2_500,
          cooldownUntil: null,
        },
        results: [],
      }),
    },
  );

  assert.deepEqual(sleeps, []);
  assert.equal(response.completed, false);
  assert.equal(response.stopReason, "runner_busy");
  assert.equal(response.throttle?.reason, "runner_busy");
});

function restoreEnv(values: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(values)) {
    if (typeof value === "string") {
      process.env[key] = value;
      continue;
    }

    delete process.env[key];
  }
}

function createSummaryDocumentRecord(
  overrides: Partial<DocumentDetailRecord> = {},
): DocumentDetailRecord {
  const now = new Date("2026-04-07T08:00:00.000Z");

  return {
    id: "doc-1",
    type: "WEB_PAGE",
    title: "如何在AI时代，找回你被埋没的创造力。",
    sourceUrl: "https://example.com/post",
    canonicalUrl: "https://example.com/post",
    externalId: null,
    aiSummary: null,
    aiSummaryStatus: null,
    aiSummaryError: null,
    lang: "zh-CN",
    excerpt: "就是各种Agent现在太火了。",
    author: "Kai",
    publishedAt: new Date("2026-03-31T02:09:33.000Z"),
    publishedAtKind: "EXACT",
    enteredReadingAt: now,
    readState: "READING",
    isFavorite: false,
    ingestionStatus: IngestionStatus.READY,
    feedId: null,
    sourceId: null,
    content: {
      contentHtml: "<p>最近看到一个现象，我觉得挺值得聊聊的。</p>",
      plainText: "最近看到一个现象，我觉得挺值得聊聊的。",
      textHash: null,
      wordCount: 1200,
      extractedAt: now,
    },
    file: null,
    tags: [],
    feed: null,
    source: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}
