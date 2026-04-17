import assert from "node:assert/strict";
import test from "node:test";
import {
  AiSummaryStatus,
  DocumentType,
  IngestionStatus,
  PublishedAtKind,
  ReadState,
  SourceKind,
  TranscriptSource,
  TranscriptStatus,
} from "@prisma/client";
import type { DocumentDetail } from "@/server/modules/documents/document.types";
import {
  buildDocumentDownloadFileName,
  buildDocumentHtmlExport,
  buildDocumentMarkdownExport,
  buildDocumentObsidianExport,
  parseDocumentDownloadFormat,
} from "@/server/modules/export/document-export.service";

function createDocument(overrides: Partial<DocumentDetail> = {}): DocumentDetail {
  const base: DocumentDetail = {
    id: "doc_123",
    type: DocumentType.WEB_PAGE,
    title: "结构化导出测试",
    sourceUrl: "https://example.com/story",
    canonicalUrl: "https://example.com/story",
    videoUrl: null,
    videoProvider: null,
    videoThumbnailUrl: null,
    videoDurationSeconds: null,
    videoEmbed: null,
    transcriptSource: null,
    transcriptStatus: null,
    aiSummary: null,
    aiSummaryStatus: AiSummaryStatus.READY,
    aiSummaryError: null,
    excerpt: "这是一段不应该替代正文的摘要。",
    lang: "zh-CN",
    author: "Kai",
    contentOrigin: null,
    publishedAt: "2026-04-03T09:30:00.000Z",
    publishedAtKind: PublishedAtKind.EXACT,
    enteredReadingAt: null,
    readState: ReadState.UNREAD,
    readingProgress: 0,
    isFavorite: true,
    ingestionStatus: IngestionStatus.READY,
    createdAt: "2026-04-03T09:40:00.000Z",
    updatedAt: "2026-04-03T09:45:00.000Z",
    tags: [],
    source: {
      id: "source_1",
      title: "Example Source",
      kind: SourceKind.RSS,
      siteUrl: "https://example.com",
      locatorUrl: "https://example.com/feed.xml",
      includeCategories: [],
      lastSyncedAt: "2026-04-03T09:35:00.000Z",
      lastSyncStatus: null,
    },
    feed: {
      id: "feed_1",
      title: "Example Feed",
      feedUrl: "https://example.com/feed.xml",
      siteUrl: "https://example.com",
    },
    file: null,
    content: {
      contentHtml: `
        <h2>小标题</h2>
        <p>第一段包含 <a href="https://example.com/link">链接</a> 和 <strong>强调</strong>。</p>
        <ul><li>要点一</li><li>要点二</li></ul>
        <blockquote><p>引用内容</p></blockquote>
        <pre><code>const answer = 42;</code></pre>
        <figure>
          <img src="https://example.com/image.png" alt="配图" />
          <figcaption>图片说明</figcaption>
        </figure>
      `,
      plainText: "小标题 第一段包含链接和强调。 要点一 要点二 引用内容 const answer = 42; 图片说明",
      wordCount: 42,
      extractedAt: "2026-04-03T09:32:00.000Z",
    },
  };

  return {
    ...base,
    ...overrides,
    source: overrides.source === undefined ? base.source : overrides.source,
    feed: overrides.feed === undefined ? base.feed : overrides.feed,
    file: overrides.file === undefined ? base.file : overrides.file,
    content: overrides.content === undefined ? base.content : overrides.content,
  };
}

test("markdown export keeps frontmatter and preserves structured content when contentHtml exists", () => {
  const exported = buildDocumentMarkdownExport(createDocument(), "2026-04-03T10:00:00.000Z");

  assert.match(exported, /^---\n/);
  assert.match(exported, /title: "结构化导出测试"/);
  assert.match(exported, /source_url: "https:\/\/example\.com\/story"/);
  assert.match(exported, /document_type: "WEB_PAGE"/);
  assert.match(exported, /ingestion_status: "READY"/);
  assert.match(exported, /## 小标题/);
  assert.match(exported, /\[链接\]\(https:\/\/example\.com\/link\)/);
  assert.match(exported, /- 要点一/);
  assert.match(exported, /> 引用内容/);
  assert.match(exported, /const answer = 42;/);
  assert.match(exported, /!\[配图\]\(https:\/\/example\.com\/image\.png\)/);
});

test("markdown export falls back to plainText when contentHtml is empty", () => {
  const exported = buildDocumentMarkdownExport(
    createDocument({
      content: {
        contentHtml: null,
        plainText: "第一行\n第二行",
        wordCount: 2,
        extractedAt: "2026-04-03T09:32:00.000Z",
      },
    }),
    "2026-04-03T10:00:00.000Z",
  );

  assert.match(exported, /第一行\n第二行/);
});

test("failed documents export metadata without turning excerpts into fake markdown bodies", () => {
  const exported = buildDocumentMarkdownExport(
    createDocument({
      ingestionStatus: IngestionStatus.FAILED,
      content: null,
      excerpt: "这是一段不应该进入正文的失败摘要。",
    }),
    "2026-04-03T10:00:00.000Z",
  );

  assert.match(exported, /ingestion_status: "FAILED"/);
  assert.doesNotMatch(exported, /失败摘要/);
});

test("html export renders lightweight readable html with metadata and cleaned content", () => {
  const exported = buildDocumentHtmlExport(createDocument(), "2026-04-03T10:00:00.000Z");

  assert.match(exported, /<!doctype html>/i);
  assert.match(exported, /<title>结构化导出测试<\/title>/);
  assert.match(exported, /<h1>结构化导出测试<\/h1>/);
  assert.match(exported, /<dt>作者<\/dt>\s*<dd>Kai<\/dd>/);
  assert.match(exported, /<h2>小标题<\/h2>/);
  assert.match(exported, /<blockquote>/);
  assert.match(exported, /<figure>/);
});

test("html export falls back to preformatted plainText when structured html is unavailable", () => {
  const exported = buildDocumentHtmlExport(
    createDocument({
      content: {
        contentHtml: null,
        plainText: "第一行\n第二行",
        wordCount: 2,
        extractedAt: "2026-04-03T09:32:00.000Z",
      },
    }),
    "2026-04-03T10:00:00.000Z",
  );

  assert.match(exported, /<pre class="document-export__plain-text">第一行\n第二行<\/pre>/);
});

test("download format parser only accepts markdown, obsidian, and html", () => {
  assert.equal(parseDocumentDownloadFormat("markdown"), "markdown");
  assert.equal(parseDocumentDownloadFormat("obsidian"), "obsidian");
  assert.equal(parseDocumentDownloadFormat("html"), "html");
  assert.throws(() => parseDocumentDownloadFormat("pdf"), /Unsupported download format/);
});

test("download filename builder slugifies titles and falls back to document id", () => {
  assert.equal(buildDocumentDownloadFileName(createDocument(), "markdown"), "结构化导出测试.md");
  assert.equal(buildDocumentDownloadFileName(createDocument(), "obsidian"), "结构化导出测试.obsidian.md");
  assert.equal(
    buildDocumentDownloadFileName(createDocument({ title: "    " }), "html"),
    "document-doc_123.html",
  );
  assert.equal(
    buildDocumentDownloadFileName(createDocument({ title: "    " }), "obsidian"),
    "document-doc_123.obsidian.md",
  );
});

test("obsidian export adds summary, highlights, and正文 sections with stable frontmatter", () => {
  const exported = buildDocumentObsidianExport(
    createDocument({
      aiSummary: "这是一条面向 Obsidian 的摘要。",
      readState: ReadState.READING,
      readingProgress: 42.4,
      tags: [
        { name: "导出", slug: "export" },
        { name: "Obsidian", slug: "obsidian" },
      ],
    }),
    [
      {
        quoteText: "第一条高亮",
        note: "这段值得复盘",
        color: "yellow",
        createdAt: "2026-04-03T09:46:00.000Z",
      },
      {
        quoteText: "第二条高亮",
        note: null,
        color: null,
        createdAt: "2026-04-03T09:47:00.000Z",
      },
    ],
    "2026-04-03T10:00:00.000Z",
  );

  assert.match(exported, /^---\n/);
  assert.match(exported, /read_state: "READING"/);
  assert.match(exported, /reading_progress: 42/);
  assert.match(exported, /tags:\n  - "export"\n  - "obsidian"/);
  assert.match(exported, /## AI 摘要\n\n这是一条面向 Obsidian 的摘要。/);
  assert.match(exported, /## 高亮与批注/);
  assert.match(exported, /### 高亮 1/);
  assert.match(exported, /> 第一条高亮/);
  assert.match(exported, /- 批注：这段值得复盘/);
  assert.match(exported, /## 正文/);
  assert.match(exported, /## 小标题/);
});
