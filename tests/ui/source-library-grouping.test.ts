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
        feed: {
          id: "feed-1",
          title: "Kai Dispatch",
        },
      }),
      createListItem({
        id: "week",
        createdAt: "2026-03-24T08:30:00.000Z",
        title: "This week",
        canonicalUrl: "https://example.com/article",
        sourceUrl: "https://example.com/article",
      }),
      createListItem({
        id: "older",
        createdAt: "2026-03-10T08:30:00.000Z",
        title: "Older title",
        canonicalUrl: "https://archive.example.com/article",
        sourceUrl: "https://archive.example.com/article",
      }),
    ],
    now,
  );

  assert.deepEqual(
    sections.map((section) => ({
      groups: section.groups.map((group) => ({
        id: group.id,
        ids: group.items.map((item) => item.id),
        label: group.label,
      })),
      label: section.label,
    })),
    [
      {
        groups: [{ id: "source:feed:feed-1", ids: ["recent"], label: "Kai Dispatch" }],
        label: "最近收进来",
      },
      {
        groups: [{ id: "source:domain:example.com", ids: ["week"], label: "example.com" }],
        label: "近七天",
      },
      {
        groups: [{ id: "source:domain:archive.example.com", ids: ["older"], label: "archive.example.com" }],
        label: "更早",
      },
    ],
  );
});

test("source shelf groups prefer feed title and fall back to hostname", () => {
  const now = new Date("2026-03-28T12:00:00.000Z");
  const [recentSection] = buildSourceShelfSections(
    [
      createListItem({
        id: "feed-a",
        createdAt: "2026-03-28T10:10:00.000Z",
        feed: {
          id: "feed-1",
          title: "Kai Dispatch",
        },
        canonicalUrl: "https://mp.weixin.qq.com/s/story-1",
        sourceUrl: "https://mp.weixin.qq.com/s/story-1",
      }),
      createListItem({
        id: "feed-b",
        createdAt: "2026-03-28T08:10:00.000Z",
        feed: {
          id: "feed-1",
          title: "Kai Dispatch",
        },
        canonicalUrl: "https://mp.weixin.qq.com/s/story-2",
        sourceUrl: "https://mp.weixin.qq.com/s/story-2",
      }),
      createListItem({
        id: "domain-a",
        createdAt: "2026-03-28T09:10:00.000Z",
        feed: null,
        canonicalUrl: "https://sspai.com/post/123",
        sourceUrl: "https://sspai.com/post/123",
      }),
    ],
    now,
  );

  assert.deepEqual(
    recentSection.groups.map((group) => ({
      id: group.id,
      ids: group.items.map((item) => item.id),
      label: group.label,
      meta: group.meta,
    })),
    [
      {
        id: "source:feed:feed-1",
        ids: ["feed-a", "feed-b"],
        label: "Kai Dispatch",
        meta: "2 篇文章",
      },
      {
        id: "source:domain:sspai.com",
        ids: ["domain-a"],
        label: "sspai.com",
        meta: "1 篇文章",
      },
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
