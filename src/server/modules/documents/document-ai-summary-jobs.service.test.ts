import assert from "node:assert/strict";
import test from "node:test";
import { AiSummaryStatus, IngestionStatus } from "@prisma/client";
import { shouldEnqueueAutomaticAiSummary } from "@/server/modules/documents/document-ai-summary-jobs.service";

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
