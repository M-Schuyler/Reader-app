import assert from "node:assert/strict";
import test from "node:test";
import { AiSummaryStatus, IngestionStatus } from "@prisma/client";
import {
  getSummaryRuntimeIssues,
  shouldBackfillAutomaticAiSummary,
  shouldEnqueueAutomaticAiSummary,
} from "@/server/modules/documents/document-ai-summary-jobs.service";

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

function restoreEnv(values: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(values)) {
    if (typeof value === "string") {
      process.env[key] = value;
      continue;
    }

    delete process.env[key];
  }
}
