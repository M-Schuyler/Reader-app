import type { DocumentDetailRecord, DocumentListRecord } from "./document.repository";
import type { CaptureIngestionError, DocumentDetail, DocumentListItem } from "./document.types";

export function mapDocumentListItem(record: DocumentListRecord): DocumentListItem {
  return {
    id: record.id,
    type: record.type,
    title: record.title,
    sourceUrl: record.sourceUrl,
    canonicalUrl: record.canonicalUrl,
    aiSummary: record.aiSummary,
    aiSummaryStatus: record.aiSummaryStatus,
    aiSummaryError: record.aiSummaryError,
    excerpt: record.excerpt,
    lang: record.lang,
    publishedAt: toIso(record.publishedAt),
    publishedAtKind: record.publishedAtKind,
    enteredReadingAt: toIso(record.enteredReadingAt),
    readState: record.readState,
    isFavorite: record.isFavorite,
    ingestionStatus: record.ingestionStatus,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    wordCount: record.content?.wordCount ?? null,
    tags: record.tags.map((entry) => ({
      name: entry.tag.name,
      slug: entry.tag.slug,
    })),
    source: record.source
      ? {
          id: record.source.id,
          title: record.source.title,
          kind: record.source.kind,
          siteUrl: record.source.siteUrl,
          locatorUrl: record.source.locatorUrl,
          includeCategories: record.source.includeCategories,
          lastSyncedAt: toIso(record.source.lastSyncedAt),
          lastSyncStatus: record.source.lastSyncStatus,
        }
      : null,
    feed: record.feed
      ? {
          id: record.feed.id,
          title: record.feed.title,
        }
      : null,
  };
}

export function mapDocumentDetail(
  record: DocumentDetailRecord,
  options?: {
    ingestionError?: CaptureIngestionError | null;
  },
): DocumentDetail {
  return {
    id: record.id,
    type: record.type,
    title: record.title,
    sourceUrl: record.sourceUrl,
    canonicalUrl: record.canonicalUrl,
    aiSummary: record.aiSummary,
    aiSummaryStatus: record.aiSummaryStatus,
    aiSummaryError: record.aiSummaryError,
    excerpt: record.excerpt,
    lang: record.lang,
    author: record.author,
    publishedAt: toIso(record.publishedAt),
    publishedAtKind: record.publishedAtKind,
    enteredReadingAt: toIso(record.enteredReadingAt),
    readState: record.readState,
    isFavorite: record.isFavorite,
    ingestionStatus: record.ingestionStatus,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    tags: record.tags.map((entry) => ({
      name: entry.tag.name,
      slug: entry.tag.slug,
    })),
    source: record.source
      ? {
          id: record.source.id,
          title: record.source.title,
          kind: record.source.kind,
          siteUrl: record.source.siteUrl,
          locatorUrl: record.source.locatorUrl,
          includeCategories: record.source.includeCategories,
          lastSyncedAt: toIso(record.source.lastSyncedAt),
          lastSyncStatus: record.source.lastSyncStatus,
        }
      : null,
    feed: record.feed
      ? {
          id: record.feed.id,
          title: record.feed.title,
          feedUrl: record.feed.feedUrl,
          siteUrl: record.feed.siteUrl,
        }
      : null,
    file: record.file
      ? {
          fileName: record.file.fileName,
          mimeType: record.file.mimeType,
          sizeBytes: record.file.sizeBytes,
          pageCount: record.file.pageCount,
        }
      : null,
    ingestion: {
      error: options?.ingestionError ?? null,
    },
    content: record.content
      ? {
          contentHtml: record.content.contentHtml,
          plainText: record.content.plainText,
          wordCount: record.content.wordCount,
          extractedAt: toIso(record.content.extractedAt),
        }
      : null,
  };
}

function toIso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}
