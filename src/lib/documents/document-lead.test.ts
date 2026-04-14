import assert from "node:assert/strict";
import test from "node:test";
import { AiSummaryStatus, IngestionStatus } from "@prisma/client";
import { resolveDocumentLead } from "@/lib/documents/document-lead";

test("resolveDocumentLead returns original excerpt and status note, even if AI summary exists", () => {
  const result = resolveDocumentLead({
    ingestionStatus: IngestionStatus.READY,
    aiSummary: "AI summary text",
    aiSummaryStatus: AiSummaryStatus.READY,
    excerpt: "Original excerpt text",
  });

  assert.equal(result.label, "原文导语");
  assert.equal(result.text, "Original excerpt text");
  assert.equal(result.note, null);
});

test("resolveDocumentLead marks excerpt clearly while AI summary is pending", () => {
  const result = resolveDocumentLead({
    ingestionStatus: IngestionStatus.READY,
    aiSummary: null,
    aiSummaryStatus: AiSummaryStatus.PENDING,
    excerpt: "Original excerpt text",
  });

  assert.equal(result.label, "原文导语");
  assert.equal(result.text, "Original excerpt text");
  assert.equal(result.note, "AI 摘要正在生成中。");
});

test("resolveDocumentLead surfaces summary failure without pretending the excerpt is AI output", () => {
  const result = resolveDocumentLead({
    ingestionStatus: IngestionStatus.READY,
    aiSummary: null,
    aiSummaryStatus: AiSummaryStatus.FAILED,
    excerpt: "Original excerpt text",
  });

  assert.equal(result.label, "原文导语");
  assert.equal(result.text, "Original excerpt text");
  assert.equal(result.note, "AI 摘要暂时没有生成出来。");
});

test("resolveDocumentLead falls back to a pending message when no excerpt is available", () => {
  const result = resolveDocumentLead({
    ingestionStatus: IngestionStatus.READY,
    aiSummary: null,
    aiSummaryStatus: AiSummaryStatus.PENDING,
    excerpt: null,
  });

  assert.equal(result.label, "AI 摘要生成中");
  assert.equal(result.text, "AI 摘要正在生成中。");
  assert.equal(result.note, null);
});
