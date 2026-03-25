import OpenAI from "openai";
import { IngestionStatus } from "@prisma/client";
import { RouteError } from "@/server/api/response";
import type { DocumentDetailRecord } from "./document.repository";
import type { AiSummarySource } from "./document.types";

const DEFAULT_AI_PROVIDER = "gemini";
const DEFAULT_GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/";
const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_OPENAI_MODEL = "gpt-5-mini";
const MAX_SOURCE_TEXT_CHARS = 12_000;
const MAX_SUMMARY_CHARS = 180;

type AiProvider = "gemini" | "openai";

type PreparedSummaryInput = {
  source: AiSummarySource;
  text: string;
};

type AiProviderConfig = {
  provider: AiProvider;
  apiKey: string;
  baseURL: string;
  model: string;
};

export async function generateDocumentAiSummary(document: DocumentDetailRecord) {
  if (document.ingestionStatus === IngestionStatus.FAILED) {
    throw new RouteError("DOCUMENT_NOT_READY_FOR_AI_SUMMARY", 409, "Failed documents do not support AI summary generation.");
  }

  const preparedInput = prepareSummaryInput(document);
  const provider = resolveAiProviderConfig();
  const client = new OpenAI({
    apiKey: provider.apiKey,
    baseURL: provider.baseURL,
  });

  try {
    const completion = await client.chat.completions.create({
      model: provider.model,
      messages: [
        {
          role: "system",
          content: buildSummaryInstructions(),
        },
        {
          role: "user",
          content: buildSummaryInput(document, preparedInput),
        },
      ],
      ...(provider.provider === "gemini" ? { reasoning_effort: "none" as const } : {}),
    });

    const summary = sanitizeSummary(extractOutputText(completion));
    if (!summary) {
      throw new RouteError("AI_SUMMARY_EMPTY", 502, "AI summary generation returned empty output.");
    }

    return {
      summary,
      source: preparedInput.source,
    };
  } catch (error) {
    throw toAiProviderError(error);
  }
}

function prepareSummaryInput(document: DocumentDetailRecord): PreparedSummaryInput {
  const contentText = normalizeBodyText(document.content?.plainText);
  if (contentText) {
    return {
      source: "content",
      text: truncateText(contentText, MAX_SOURCE_TEXT_CHARS),
    };
  }

  const excerptText = normalizeBodyText(document.excerpt);
  if (excerptText) {
    return {
      source: "excerpt",
      text: truncateText(excerptText, 1_500),
    };
  }

  const metadataText = normalizeBodyText(
    [
      `标题：${document.title}`,
      document.author ? `作者：${document.author}` : null,
      document.publishedAt ? `发布时间：${document.publishedAt.toISOString()}` : null,
      document.sourceUrl ? `来源链接：${document.sourceUrl}` : document.canonicalUrl ? `来源链接：${document.canonicalUrl}` : null,
    ]
      .filter((value): value is string => Boolean(value))
      .join("\n"),
  );

  if (metadataText) {
    return {
      source: "metadata",
      text: metadataText,
    };
  }

  throw new RouteError("AI_SUMMARY_INPUT_EMPTY", 409, "Document does not have usable content for AI summary generation.");
}

function buildSummaryInstructions() {
  return [
    "你是 reader 应用的文档摘要器。",
    "请输出一段适合显示在文档标题下方的短摘要。",
    "要求：",
    "1. 使用简体中文。",
    "2. 1 到 2 句，尽量控制在 30 到 80 个汉字内。",
    "3. 只保留主题、核心观点或关键信息，不写空话，不写“本文介绍了”。",
    "4. 不要添加原文没有的信息。",
    "5. 如果输入不完整，只做保守概括，不要臆测。",
  ].join("\n");
}

function buildSummaryInput(document: DocumentDetailRecord, preparedInput: PreparedSummaryInput) {
  return [
    `文档类型：${document.type}`,
    `标题：${document.title}`,
    document.author ? `作者：${document.author}` : null,
    document.publishedAt ? `发布时间：${document.publishedAt.toISOString()}` : null,
    `摘要输入来源：${preparedInput.source}`,
    "",
    "请基于以下材料生成短摘要：",
    preparedInput.text,
  ]
    .filter((value): value is string => Boolean(value))
    .join("\n");
}

function normalizeBodyText(value: string | null | undefined) {
  const normalized = value?.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return normalized ? normalized : null;
}

function truncateText(value: string, maxChars: number) {
  if (value.length <= maxChars) {
    return value;
  }

  return `${value.slice(0, maxChars).trimEnd()}\n\n[内容过长，已截断]`;
}

function sanitizeSummary(value: string | null) {
  const normalized = value?.replace(/\s+/g, " ").replace(/^["'“”]+|["'“”]+$/g, "").trim();
  if (!normalized) {
    return null;
  }

  if (normalized.length <= MAX_SUMMARY_CHARS) {
    return normalized;
  }

  return normalized.slice(0, MAX_SUMMARY_CHARS).trimEnd();
}

function resolveAiProviderConfig(): AiProviderConfig {
  const provider = normalizeProvider(process.env.AI_PROVIDER) ?? DEFAULT_AI_PROVIDER;

  if (provider === "gemini") {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      throw new RouteError("AI_PROVIDER_NOT_CONFIGURED", 503, "GEMINI_API_KEY is not configured.");
    }

    return {
      provider,
      apiKey,
      baseURL: process.env.GEMINI_BASE_URL?.trim() || DEFAULT_GEMINI_BASE_URL,
      model: process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL,
    };
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new RouteError("AI_PROVIDER_NOT_CONFIGURED", 503, "OPENAI_API_KEY is not configured.");
  }

  return {
    provider,
    apiKey,
    baseURL: process.env.OPENAI_BASE_URL?.trim() || DEFAULT_OPENAI_BASE_URL,
    model: process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL,
  };
}

function normalizeProvider(value: string | undefined): AiProvider | null {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (normalized === "gemini" || normalized === "openai") {
    return normalized;
  }

  throw new RouteError("AI_PROVIDER_UNSUPPORTED", 500, `AI provider "${value}" is not supported.`);
}

function extractOutputText(completion: {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }> | null;
    };
  }>;
}) {
  const content = completion.choices?.[0]?.message?.content;

  if (typeof content === "string" && content.trim()) {
    return content;
  }

  if (!Array.isArray(content)) {
    return null;
  }

  const textParts = content
    .filter((item) => item.type === "text" && typeof item.text === "string")
    .map((item) => item.text?.trim() ?? "")
    .filter((text) => text.length > 0);

  return textParts.length > 0 ? textParts.join("\n") : null;
}

function toAiProviderError(error: unknown) {
  if (error instanceof RouteError) {
    return error;
  }

  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string" &&
    (error as { message: string }).message.trim()
  ) {
    return new RouteError("AI_PROVIDER_REQUEST_FAILED", 502, (error as { message: string }).message.trim());
  }

  return new RouteError("AI_PROVIDER_REQUEST_FAILED", 502, "AI provider request failed.");
}
