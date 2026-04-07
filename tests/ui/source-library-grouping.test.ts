import assert from "node:assert/strict";
import test from "node:test";
import { AiSummaryStatus, DocumentType, IngestionStatus, PublishedAtKind, ReadState } from "@prisma/client";
import {
  buildSourceAliasMap,
  buildSourceLibrarySourceContext,
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

test("source aliases override displayed shelf names without changing source identity", () => {
  const aliasMap = buildSourceAliasMap([
    {
      kind: "domain",
      name: "微信公众号",
      value: "mp.weixin.qq.com",
    },
    {
      kind: "feed",
      name: "凯的通讯",
      value: "feed-1",
    },
  ]);
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
        id: "domain-a",
        createdAt: "2026-03-28T09:10:00.000Z",
        feed: null,
        canonicalUrl: "https://mp.weixin.qq.com/s/story-2",
        sourceUrl: "https://mp.weixin.qq.com/s/story-2",
      }),
    ],
    now,
    aliasMap,
  );

  assert.deepEqual(
    recentSection.groups.map((group) => ({
      customLabel: group.customLabel,
      defaultLabel: group.defaultLabel,
      id: group.id,
      label: group.label,
    })),
    [
      {
        customLabel: "凯的通讯",
        defaultLabel: "Kai Dispatch",
        id: "source:feed:feed-1",
        label: "凯的通讯",
      },
      {
        customLabel: "微信公众号",
        defaultLabel: "mp.weixin.qq.com",
        id: "source:domain:mp.weixin.qq.com",
        label: "微信公众号",
      },
    ],
  );

  const sourceContext = buildSourceLibrarySourceContext(
    createListItem({
      id: "domain-context",
      canonicalUrl: "https://mp.weixin.qq.com/s/story-3",
      sourceUrl: "https://mp.weixin.qq.com/s/story-3",
    }),
    3,
    aliasMap,
  );

  assert.equal(sourceContext.label, "微信公众号");
  assert.equal(sourceContext.defaultLabel, "mp.weixin.qq.com");
  assert.equal(sourceContext.customLabel, "微信公众号");
});

test("source shelf keeps one top-level cover per source based on the latest arrival", () => {
  const now = new Date("2026-03-28T12:00:00.000Z");
  const sections = buildSourceShelfSections(
    [
      createListItem({
        id: "recent-feed",
        createdAt: "2026-03-28T10:10:00.000Z",
        feed: {
          id: "feed-1",
          title: "Kai Dispatch",
        },
        canonicalUrl: "https://mp.weixin.qq.com/s/story-1",
        sourceUrl: "https://mp.weixin.qq.com/s/story-1",
      }),
      createListItem({
        id: "week-feed",
        createdAt: "2026-03-24T10:10:00.000Z",
        feed: {
          id: "feed-1",
          title: "Kai Dispatch",
        },
        canonicalUrl: "https://mp.weixin.qq.com/s/story-2",
        sourceUrl: "https://mp.weixin.qq.com/s/story-2",
      }),
      createListItem({
        id: "week-domain",
        createdAt: "2026-03-24T09:10:00.000Z",
        feed: null,
        canonicalUrl: "https://sspai.com/post/123",
        sourceUrl: "https://sspai.com/post/123",
      }),
    ],
    now,
  );

  assert.deepEqual(
    sections.map((section) => ({
      groups: section.groups.map((group) => ({
        id: group.id,
        ids: group.items.map((item) => item.id),
      })),
      label: section.label,
    })),
    [
      {
        groups: [
          {
            id: "source:feed:feed-1",
            ids: ["recent-feed", "week-feed"],
          },
        ],
        label: "最近收进来",
      },
      {
        groups: [
          {
            id: "source:domain:sspai.com",
            ids: ["week-domain"],
          },
        ],
        label: "近七天",
      },
    ],
  );
});

test("explicit source metadata overrides feed and domain inference", () => {
  const now = new Date("2026-03-28T12:00:00.000Z");
  const first = createListItem({
    id: "wechat-1",
    canonicalUrl: "https://mp.weixin.qq.com/s/story-1",
    sourceUrl: "https://mp.weixin.qq.com/s/story-1",
  });
  const second = createListItem({
    id: "wechat-2",
    canonicalUrl: "https://mp.weixin.qq.com/s/story-2",
    sourceUrl: "https://mp.weixin.qq.com/s/story-2",
  });

  Object.assign(first as Record<string, unknown>, {
    source: {
      id: "source-qbian",
      kind: "WECHAT_ARCHIVE",
      title: "请辩",
      includeCategories: ["Technology", "Policy", "Culture"],
    },
  });
  Object.assign(second as Record<string, unknown>, {
    source: {
      id: "source-other",
      kind: "WECHAT_ARCHIVE",
      title: "另一份来源",
      includeCategories: [],
    },
  });

  const [recentSection] = buildSourceShelfSections([first, second], now);

  assert.deepEqual(
    recentSection.groups.map((group) => ({
      filterSummary: group.filterSummary,
      href: group.href,
      id: group.id,
      ids: group.items.map((item) => item.id),
      kind: group.kind,
      label: group.label,
      value: group.value,
    })),
    [
      {
        filterSummary: "分类过滤 · Technology, Policy +1",
        href: "/sources/source-qbian",
        id: "source:source-qbian",
        ids: ["wechat-1"],
        kind: "source",
        label: "请辩",
        value: "source-qbian",
      },
      {
        filterSummary: null,
        href: "/sources/source-other",
        id: "source:source-other",
        ids: ["wechat-2"],
        kind: "source",
        label: "另一份来源",
        value: "source-other",
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

test("web pages with missing publishedAt still form domain source cards by createdAt recency", () => {
  const now = new Date("2026-03-28T12:00:00.000Z");
  const [recentSection] = buildSourceShelfSections(
    [
      createListItem({
        id: "web-new-1",
        type: DocumentType.WEB_PAGE,
        createdAt: "2026-03-28T11:20:00.000Z",
        publishedAt: null,
        canonicalUrl: "https://sspai.com/post/1",
        sourceUrl: "https://sspai.com/post/1",
      }),
      createListItem({
        id: "web-new-2",
        type: DocumentType.WEB_PAGE,
        createdAt: "2026-03-28T10:10:00.000Z",
        publishedAt: null,
        canonicalUrl: "https://sspai.com/post/2",
        sourceUrl: "https://sspai.com/post/2",
      }),
      createListItem({
        id: "web-other-host",
        type: DocumentType.WEB_PAGE,
        createdAt: "2026-03-28T09:10:00.000Z",
        publishedAt: null,
        canonicalUrl: "https://example.com/article",
        sourceUrl: "https://example.com/article",
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
      value: group.value,
    })),
    [
      {
        href: "/sources/domain/sspai.com",
        id: "source:domain:sspai.com",
        ids: ["web-new-1", "web-new-2"],
        kind: "domain",
        label: "sspai.com",
        value: "sspai.com",
      },
      {
        href: "/sources/domain/example.com",
        id: "source:domain:example.com",
        ids: ["web-other-host"],
        kind: "domain",
        label: "example.com",
        value: "example.com",
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
    aiSummaryStatus: AiSummaryStatus.READY,
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
    tags: [],
    source: null,
    feed: null,
    ...overrides,
  };
}
