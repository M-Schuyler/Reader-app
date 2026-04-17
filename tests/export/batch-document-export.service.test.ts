import assert from "node:assert/strict";
import test from "node:test";
import JSZip from "jszip";
import {
  AiSummaryStatus,
  DocumentType,
  IngestionStatus,
  PublishedAtKind,
  ReadState,
  SourceKind,
} from "@prisma/client";
import type { DocumentDetail } from "@/server/modules/documents/document.types";
import {
  buildBatchDocumentDownloadArchive,
  MAX_BATCH_EXPORT_DOCUMENTS,
  parseBatchDocumentDownloadInput,
} from "@/server/modules/export/batch-document-export.service";

test("batch export parser normalizes ids, defaults format, and validates limits", () => {
  assert.deepEqual(
    parseBatchDocumentDownloadInput({
      documentIds: [" doc-1 ", "doc-2", "doc-1"],
    }),
    {
      documentIds: ["doc-1", "doc-2"],
      format: "obsidian",
    },
  );

  assert.equal(
    parseBatchDocumentDownloadInput({
      documentIds: ["doc-1"],
      format: "markdown",
    }).format,
    "markdown",
  );

  assert.throws(
    () =>
      parseBatchDocumentDownloadInput({
        documentIds: [],
      }),
    /Select at least one document/,
  );

  assert.throws(
    () =>
      parseBatchDocumentDownloadInput({
        documentIds: Array.from({ length: MAX_BATCH_EXPORT_DOCUMENTS + 1 }).map((_, index) => `doc-${index}`),
      }),
    /Batch export supports up to/,
  );
});

test("batch export archive contains files, deduplicates names, and writes missing-id report", async () => {
  const documents = new Map<string, DocumentDetail>([
    ["doc-1", createDocument("doc-1", "重复标题", "第一篇内容")],
    ["doc-2", createDocument("doc-2", "重复标题", "第二篇内容")],
  ]);

  const archive = await buildBatchDocumentDownloadArchive(
    {
      documentIds: ["doc-1", "doc-2", "missing-doc"],
      format: "obsidian",
    },
    {
      getDocument: async (id) => {
        const document = documents.get(id);
        return document ? { document } : null;
      },
      listExportHighlightsByDocumentIds: async () => [
        {
          documentId: "doc-1",
          quoteText: "一条高亮",
          note: "一条批注",
          color: null,
          createdAt: new Date("2026-04-15T02:00:00.000Z"),
        },
      ],
      now: () => new Date("2026-04-15T02:30:00.000Z"),
    },
  );

  assert.equal(archive.exportedCount, 2);
  assert.deepEqual(archive.missingIds, ["missing-doc"]);
  assert.match(archive.fileName, /reader-batch-export-obsidian-20260415-023000\.zip/);

  const zip = await JSZip.loadAsync(archive.content);
  const fileNames = Object.keys(zip.files).filter((name) => !zip.files[name].dir).sort();

  assert.deepEqual(fileNames, [
    "reader-export/_export-report.md",
    "reader-export/重复标题 (2).obsidian.md",
    "reader-export/重复标题.obsidian.md",
  ]);

  const firstDocument = await zip.file("reader-export/重复标题.obsidian.md")?.async("string");
  const secondDocument = await zip.file("reader-export/重复标题 (2).obsidian.md")?.async("string");
  const report = await zip.file("reader-export/_export-report.md")?.async("string");

  assert.ok(firstDocument);
  assert.ok(secondDocument);
  assert.ok(report);

  assert.match(firstDocument, /## 高亮与批注/);
  assert.match(firstDocument, /一条高亮/);
  assert.match(firstDocument, /一条批注/);
  assert.match(secondDocument, /第二篇内容/);
  assert.match(report, /missing-doc/);
});

function createDocument(id: string, title: string, plainText: string): DocumentDetail {
  return {
    id,
    type: DocumentType.WEB_PAGE,
    title,
    sourceUrl: "https://example.com",
    canonicalUrl: "https://example.com",
    videoUrl: null,
    videoProvider: null,
    videoThumbnailUrl: null,
    videoDurationSeconds: null,
    videoEmbed: null,
    transcriptSource: null,
    transcriptStatus: null,
    aiSummary: "摘要",
    aiSummaryStatus: AiSummaryStatus.READY,
    aiSummaryError: null,
    excerpt: null,
    lang: "zh-CN",
    author: "Reader",
    contentOrigin: null,
    publishedAt: "2026-04-15T01:00:00.000Z",
    publishedAtKind: PublishedAtKind.EXACT,
    enteredReadingAt: null,
    readState: ReadState.READING,
    readingProgress: 42,
    isFavorite: true,
    ingestionStatus: IngestionStatus.READY,
    createdAt: "2026-04-15T01:10:00.000Z",
    updatedAt: "2026-04-15T01:20:00.000Z",
    tags: [{ name: "批量导出", slug: "batch-export" }],
    source: {
      id: "source-1",
      title: "Source",
      kind: SourceKind.RSS,
      siteUrl: "https://example.com",
      locatorUrl: "https://example.com/feed.xml",
      includeCategories: [],
      lastSyncedAt: null,
      lastSyncStatus: null,
    },
    feed: {
      id: "feed-1",
      title: "Feed",
      feedUrl: "https://example.com/feed.xml",
      siteUrl: "https://example.com",
    },
    file: null,
    ingestion: {
      error: null,
    },
    content: {
      contentHtml: null,
      plainText,
      wordCount: plainText.length,
      extractedAt: "2026-04-15T01:05:00.000Z",
    },
  };
}
