import assert from "node:assert/strict";
import test from "node:test";
import { AiSummaryStatus, IngestionStatus } from "@prisma/client";
import { resolveDocumentLead } from "@/lib/documents/document-lead";

test("resolveDocumentLead prefers the AI summary when it exists", () => {
  assert.deepEqual(
    resolveDocumentLead({
      ingestionStatus: IngestionStatus.READY,
      aiSummary: "这是一段 AI 摘要。",
      aiSummaryStatus: AiSummaryStatus.READY,
      excerpt: "这是一段原文导语。",
    }),
    {
      label: "AI 摘要",
      text: "这是一段 AI 摘要。",
      note: null,
    },
  );
});

test("resolveDocumentLead marks excerpt fallback clearly while AI summary is pending", () => {
  assert.deepEqual(
    resolveDocumentLead({
      ingestionStatus: IngestionStatus.READY,
      aiSummary: null,
      aiSummaryStatus: AiSummaryStatus.PENDING,
      excerpt: "这是一段原文导语。",
    }),
    {
      label: "原文导语",
      text: "这是一段原文导语。",
      note: "AI 摘要正在生成中。",
    },
  );
});

test("resolveDocumentLead surfaces summary failure without pretending the excerpt is AI output", () => {
  assert.deepEqual(
    resolveDocumentLead({
      ingestionStatus: IngestionStatus.READY,
      aiSummary: null,
      aiSummaryStatus: AiSummaryStatus.FAILED,
      excerpt: "这是一段原文导语。",
    }),
    {
      label: "原文导语",
      text: "这是一段原文导语。",
      note: "AI 摘要暂时没有生成出来。",
    },
  );
});

test("resolveDocumentLead falls back to a pending message when no excerpt is available", () => {
  assert.deepEqual(
    resolveDocumentLead({
      ingestionStatus: IngestionStatus.READY,
      aiSummary: null,
      aiSummaryStatus: AiSummaryStatus.PENDING,
      excerpt: null,
    }),
    {
      label: "AI 摘要生成中",
      text: "AI 摘要正在生成中。",
      note: null,
    },
  );
});
