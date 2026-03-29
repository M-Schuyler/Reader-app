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
        href: group.href,
        id: group.id,
        ids: group.items.map((item) => item.id),
        kind: group.kind,
        label: group.label,
        value: group.value,
      })),
      label: section.label,
    })),
    [
      {
        groups: [
          {
            href: "/sources/feed/feed-1",
            id: "source:feed:feed-1",
            ids: ["recent"],
            kind: "feed",
            label: "Kai Dispatch",
            value: "feed-1",
          },
        ],
        label: "最近收进来",
      },
      {
        groups: [
          {
            href: "/sources/domain/example.com",
            id: "source:domain:example.com",
            ids: ["week"],
            kind: "domain",
            label: "example.com",
            value: "example.com",
          },
        ],
        label: "近七天",
      },
      {
        groups: [
          {
            href: "/sources/domain/archive.example.com",
            id: "source:domain:archive.example.com",
            ids: ["older"],
            kind: "domain",
            label: "archive.example.com",
            value: "archive.example.com",
          },
        ],
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
      href: group.href,
      id: group.id,
      ids: group.items.map((item) => item.id),
      kind: group.kind,
      label: group.label,
      meta: group.meta,
      value: group.value,
    })),
    [
      {
        href: "/sources/feed/feed-1",
        id: "source:feed:feed-1",
        ids: ["feed-a", "feed-b"],
        kind: "feed",
        label: "Kai Dispatch",
        meta: "2 篇文章",
        value: "feed-1",
      },
      {
        href: "/sources/domain/sspai.com",
        id: "source:domain:sspai.com",
        ids: ["domain-a"],
        kind: "domain",
        label: "sspai.com",
        meta: "1 篇文章",
        value: "sspai.com",
      },
    ],
  );
});

test("unknown sources stay grouped but do not generate detail links", () => {
  const [recentSection] = buildSourceShelfSections(
    [
      createListItem({
        id: "unknown-source",
        canonicalUrl: null,
        sourceUrl: null,
        feed: null,
      }),
    ],
    new Date("2026-03-28T12:00:00.000Z"),
  );

  assert.equal(recentSection.groups[0]?.id, "source:url:unknown-source");
  assert.equal(recentSection.groups[0]?.label, "未知来源");
  assert.equal(recentSection.groups[0]?.kind, "unknown");
  assert.equal(recentSection.groups[0]?.value, null);
  assert.equal(recentSection.groups[0]?.href, null);
  assert.equal(recentSection.groups[0]?.meta, "1 篇文章");
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
