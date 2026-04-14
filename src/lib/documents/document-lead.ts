import { AiSummaryStatus, IngestionStatus } from "@prisma/client";

type ResolveDocumentLeadInput = {
  ingestionStatus: IngestionStatus;
  aiSummary: string | null;
  aiSummaryStatus: AiSummaryStatus | null;
  excerpt: string | null;
};

export type DocumentLead = {
  label: string | null;
  text: string | null;
  note: string | null;
};

export function resolveDocumentLead(input: ResolveDocumentLeadInput): DocumentLead {
  if (input.ingestionStatus === IngestionStatus.FAILED) {
    return {
      label: null,
      text: null,
      note: null,
    };
  }

  const excerpt = normalizeText(input.excerpt);
  if (excerpt) {
    return {
      label: "原文导语",
      text: excerpt,
      note: resolveLeadNote(input.aiSummaryStatus),
    };
  }

  if (input.aiSummaryStatus === AiSummaryStatus.PENDING) {
    return {
      label: "AI 摘要生成中",
      text: "AI 摘要正在生成中。",
      note: null,
    };
  }

  if (input.aiSummaryStatus === AiSummaryStatus.FAILED) {
    return {
      label: "AI 摘要未就绪",
      text: "AI 摘要暂时没有生成出来。",
      note: null,
    };
  }

  return {
    label: null,
    text: null,
    note: null,
  };
}

function normalizeText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function resolveLeadNote(status: AiSummaryStatus | null) {
  if (status === AiSummaryStatus.PENDING) {
    return "AI 摘要正在生成中。";
  }

  if (status === AiSummaryStatus.FAILED) {
    return "AI 摘要暂时没有生成出来。";
  }

  return null;
}
