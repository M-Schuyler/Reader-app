import { NodeHtmlMarkdown } from "node-html-markdown";
import type { DocumentDetail } from "@/server/modules/documents/document.types";
import { RouteError } from "@/server/api/response";
import type { BuiltDocumentDownload, DocumentDownloadFormat } from "./document-export.types";

const markdownConverter = new NodeHtmlMarkdown({
  bulletMarker: "-",
  codeFence: "```",
  textReplace: [
    [/\u00a0/g, " "],
  ],
});

type ObsidianExportHighlight = {
  quoteText: string;
  note: string | null;
  color: string | null;
  createdAt: string | Date;
};

type BuildDocumentDownloadOptions = {
  highlights?: ObsidianExportHighlight[];
  exportedAt?: string;
};

export function parseDocumentDownloadFormat(value: string | null | undefined): DocumentDownloadFormat {
  if (value === "markdown" || value === "html" || value === "obsidian") {
    return value;
  }

  throw new RouteError("INVALID_DOWNLOAD_FORMAT", 400, "Unsupported download format.");
}

export function buildDocumentDownload(
  document: DocumentDetail,
  format: DocumentDownloadFormat,
  options: BuildDocumentDownloadOptions = {},
): BuiltDocumentDownload {
  const exportedAt = options.exportedAt ?? new Date().toISOString();

  if (format === "markdown") {
    return {
      content: buildDocumentMarkdownExport(document, exportedAt),
      contentType: "text/markdown; charset=utf-8",
      extension: "md",
    };
  }

  if (format === "obsidian") {
    return {
      content: buildDocumentObsidianExport(document, options.highlights ?? [], exportedAt),
      contentType: "text/markdown; charset=utf-8",
      extension: "md",
    };
  }

  return {
    content: buildDocumentHtmlExport(document, exportedAt),
    contentType: "text/html; charset=utf-8",
    extension: "html",
  };
}

export function buildDocumentMarkdownExport(document: DocumentDetail, exportedAt = new Date().toISOString()) {
  const frontmatter = buildYamlFrontmatter(document, exportedAt);
  const body = resolveMarkdownBody(document);

  return `${frontmatter}\n\n${body}`.trimEnd();
}

export function buildDocumentHtmlExport(document: DocumentDetail, exportedAt = new Date().toISOString()) {
  const title = escapeHtml(document.title);
  const bodyHtml = resolveHtmlBody(document);
  const metadataRows = [
    renderMetadataRow("作者", document.author),
    renderMetadataRow("发布时间", document.publishedAt),
    renderMetadataRow("原始链接", document.sourceUrl),
    renderMetadataRow("规范链接", document.canonicalUrl),
    renderMetadataRow("文档类型", document.type),
    renderMetadataRow("抓取状态", document.ingestionStatus),
    renderMetadataRow("导出时间", exportedAt),
  ]
    .filter(Boolean)
    .join("");

  return [
    "<!doctype html>",
    '<html lang="zh-CN">',
    "<head>",
    '  <meta charset="utf-8" />',
    '  <meta name="viewport" content="width=device-width, initial-scale=1" />',
    `  <title>${title}</title>`,
    "  <style>",
    "    :root { color-scheme: light; }",
    "    body { margin: 0; background: #f6f2eb; color: #1f1a17; font-family: 'PingFang SC', 'Noto Serif SC', serif; }",
    "    main { max-width: 780px; margin: 0 auto; padding: 48px 24px 80px; }",
    "    header { margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid rgba(31, 26, 23, 0.12); }",
    "    h1 { margin: 0 0 18px; font-size: 2rem; line-height: 1.1; }",
    "    dl { display: grid; grid-template-columns: auto 1fr; gap: 10px 18px; margin: 0; font-size: 0.95rem; }",
    "    dt { color: rgba(31, 26, 23, 0.56); }",
    "    dd { margin: 0; word-break: break-word; }",
    "    article { font-size: 1.06rem; line-height: 1.95; }",
    "    article img { max-width: 100%; height: auto; }",
    "    article pre { overflow-x: auto; padding: 16px; border-radius: 16px; background: rgba(31, 26, 23, 0.06); }",
    "    article blockquote { margin: 1.25rem 0; padding-left: 1rem; border-left: 3px solid rgba(31, 26, 23, 0.18); color: rgba(31, 26, 23, 0.76); }",
    "    .document-export__plain-text { white-space: pre-wrap; word-break: break-word; padding: 18px; border-radius: 18px; background: rgba(31, 26, 23, 0.05); }",
    "  </style>",
    "</head>",
    "<body>",
    "  <main>",
    "    <header>",
    `      <h1>${title}</h1>`,
    `      <dl>${metadataRows}</dl>`,
    "    </header>",
    `    <article>${bodyHtml}</article>`,
    "  </main>",
    "</body>",
    "</html>",
  ].join("\n");
}

export function buildDocumentObsidianExport(
  document: DocumentDetail,
  highlights: ObsidianExportHighlight[] = [],
  exportedAt = new Date().toISOString(),
) {
  const frontmatter = buildObsidianFrontmatter(document, exportedAt);
  const sections: string[] = [];
  const summary = normalizeText(document.aiSummary);

  if (summary) {
    sections.push(["## AI 摘要", summary].join("\n\n"));
  }

  sections.push(buildObsidianHighlightsSection(highlights));

  const body = resolveMarkdownBody(document);
  sections.push(["## 正文", body || "（无可导出的正文内容）"].join("\n\n"));

  return `${frontmatter}\n\n${sections.join("\n\n")}`.trimEnd();
}

export function buildDocumentDownloadFileName(document: DocumentDetail, format: DocumentDownloadFormat) {
  const extension = format === "html" ? "html" : "md";
  const safeTitle = slugifyFileName(document.title);
  const baseName = safeTitle ? safeTitle : `document-${document.id}`;

  if (format === "obsidian") {
    return `${baseName}.obsidian.${extension}`;
  }

  return `${baseName}.${extension}`;
}

function resolveMarkdownBody(document: DocumentDetail) {
  const contentHtml = document.content?.contentHtml?.trim();
  if (contentHtml) {
    return markdownConverter.translate(contentHtml).trim();
  }

  const plainText = document.content?.plainText?.trim();
  if (plainText) {
    return plainText;
  }

  return "";
}

function resolveHtmlBody(document: DocumentDetail) {
  const contentHtml = document.content?.contentHtml?.trim();
  if (contentHtml) {
    return contentHtml;
  }

  const plainText = document.content?.plainText?.trim();
  if (plainText) {
    return `<pre class="document-export__plain-text">${escapeHtml(plainText)}</pre>`;
  }

  return "";
}

function buildYamlFrontmatter(document: DocumentDetail, exportedAt: string) {
  const lines = [
    "---",
    toYamlScalarLine("title", document.title),
    toYamlScalarLine("source_url", document.sourceUrl),
    toYamlScalarLine("canonical_url", document.canonicalUrl),
    toYamlScalarLine("author", document.author),
    toYamlScalarLine("published_at", document.publishedAt),
    toYamlScalarLine("document_type", document.type),
    toYamlScalarLine("ingestion_status", document.ingestionStatus),
    toYamlScalarLine("exported_at", exportedAt),
    "---",
  ];

  return lines.join("\n");
}

function buildObsidianFrontmatter(document: DocumentDetail, exportedAt: string) {
  const lines = [
    "---",
    toYamlScalarLine("title", document.title),
    toYamlScalarLine("source_url", document.sourceUrl),
    toYamlScalarLine("canonical_url", document.canonicalUrl),
    toYamlScalarLine("author", document.author),
    toYamlScalarLine("published_at", document.publishedAt),
    toYamlScalarLine("document_type", document.type),
    toYamlScalarLine("ingestion_status", document.ingestionStatus),
    toYamlScalarLine("read_state", document.readState),
    toYamlScalarLine("reading_progress", Math.max(0, Math.min(100, Math.round(document.readingProgress)))),
    toYamlScalarLine("is_favorite", document.isFavorite),
    toYamlScalarLine("content_origin", document.contentOrigin?.label ?? null),
    ...toYamlArrayLines("tags", document.tags.map((tag) => tag.slug)),
    toYamlScalarLine("exported_at", exportedAt),
    "---",
  ];

  return lines.join("\n");
}

function buildObsidianHighlightsSection(highlights: ObsidianExportHighlight[]) {
  const normalizedHighlights = highlights
    .map((highlight) => ({
      quoteText: normalizeText(highlight.quoteText),
      note: normalizeText(highlight.note),
      color: normalizeText(highlight.color),
      createdAt: normalizeHighlightCreatedAt(highlight.createdAt),
    }))
    .filter((highlight): highlight is { quoteText: string; note: string | null; color: string | null; createdAt: string } =>
      Boolean(highlight.quoteText),
    );

  if (normalizedHighlights.length === 0) {
    return ["## 高亮与批注", "（暂无高亮）"].join("\n\n");
  }

  const entries = normalizedHighlights.map((highlight, index) => {
    const lines = [
      `### 高亮 ${index + 1}`,
      formatObsidianQuote(highlight.quoteText),
      highlight.note ? `- 批注：${highlight.note}` : null,
      highlight.color ? `- 颜色：${highlight.color}` : null,
      `- 创建时间：${highlight.createdAt}`,
    ]
      .filter((line): line is string => Boolean(line))
      .join("\n");

    return lines;
  });

  return ["## 高亮与批注", entries.join("\n\n")].join("\n\n");
}

function toYamlScalarLine(key: string, value: string | number | boolean | null) {
  if (value === null) {
    return `${key}: null`;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return `${key}: ${String(value)}`;
  }

  return `${key}: ${JSON.stringify(value)}`;
}

function toYamlArrayLines(key: string, values: string[]) {
  if (values.length === 0) {
    return [`${key}: []`];
  }

  return [
    `${key}:`,
    ...values.map((value) => `  - ${JSON.stringify(value)}`),
  ];
}

function renderMetadataRow(label: string, value: string | null) {
  if (!value) {
    return "";
  }

  return `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd>`;
}

function slugifyFileName(value: string | null | undefined) {
  const normalized = (value ?? "")
    .normalize("NFKC")
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return normalized || "";
}

function formatObsidianQuote(value: string) {
  return value
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
}

function normalizeText(value: string | null | undefined) {
  const normalized = value?.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return normalized ? normalized : null;
}

function normalizeHighlightCreatedAt(value: string | Date) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return normalizeText(value) ?? new Date(0).toISOString();
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
