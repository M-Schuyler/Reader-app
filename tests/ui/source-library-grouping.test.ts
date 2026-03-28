import assert from "node:assert/strict";
import test from "node:test";
import { AiSummaryStatus, DocumentType, IngestionStatus, PublishedAtKind, ReadState } from "@prisma/client";
import {
  buildSourceShelfSections,
  resolveSourceLibraryPreviewText,
} from "@/lib/documents/source-library";
import type { DocumentListItem } from "@/server/modules/documents/document.types";

test("source shelf sections group documents by createdAt recency", () => {
  const now = new Date("2026-03-28T12:00:00.000Z");
  const sections = buildSourceShelfSections(
    [
      createListItem({
        id: "recent",
        createdAt: "2026-03-28T06:30:00.000Z",
        title: "Recent arrival",
      }),
      createListItem({
        id: "week",
        createdAt: "2026-03-24T08:30:00.000Z",
        title: "This week",
      }),
      createListItem({
        id: "older",
        createdAt: "2026-03-10T08:30:00.000Z",
        title: "Older title",
      }),
    ],
    now,
  );

  assert.deepEqual(
    sections.map((section) => ({ ids: section.items.map((item) => item.id), label: section.label })),
    [
      { ids: ["recent"], label: "最近收进来" },
      { ids: ["week"], label: "近七天" },
      { ids: ["older"], label: "更早" },
    ],
  );
});

test("source library preview prefers ai summary and hides failed pseudo excerpts", () => {
  assert.equal(
    resolveSourceLibraryPreviewText(
      createListItem({
        aiSummary: "AI summary first",
        excerpt: "Fallback excerpt",
      }),
    ),
    "AI summary first",
  );

  assert.equal(
    resolveSourceLibraryPreviewText(
      createListItem({
        aiSummary: null,
        excerpt: "Fallback excerpt",
      }),
    ),
    "Fallback excerpt",
  );

  assert.equal(
    resolveSourceLibraryPreviewText(
      createListItem({
        aiSummary: "Should hide",
        excerpt: "Should also hide",
        ingestionStatus: IngestionStatus.FAILED,
      }),
    ),
    null,
  );
});

function createListItem(overrides: Partial<DocumentListItem> = {}): DocumentListItem {
  return {
    id: "doc-1",
    type: DocumentType.WEB_PAGE,
    title: "Source title",
    sourceUrl: "https://example.com/article",
    canonicalUrl: "https://example.com/article",
    aiSummary: null,
    aiSummaryStatus: AiSummaryStatus.COMPLETED,
    aiSummaryError: null,
    excerpt: "Default excerpt",
    lang: "zh",
    publishedAt: "2026-03-27T08:30:00.000Z",
    publishedAtKind: PublishedAtKind.EXACT,
    enteredReadingAt: null,
    readState: ReadState.UNREAD,
    isFavorite: false,
    ingestionStatus: IngestionStatus.READY,
    createdAt: "2026-03-27T08:30:00.000Z",
    updatedAt: "2026-03-27T08:30:00.000Z",
    wordCount: 1200,
    feed: null,
    ...overrides,
  };
}
