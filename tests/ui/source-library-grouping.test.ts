import assert from "node:assert/strict";
import test from "node:test";
import { AiSummaryStatus, DocumentType, IngestionStatus, PublishedAtKind, ReadState } from "@prisma/client";
import {
  buildSourceAliasMap,
  buildSourceLibraryIndexGroups,
  buildSourceLibrarySourceContext,
  resolveSourceLibraryPreviewText,
} from "@/lib/documents/source-library";
import type { DocumentListItem, SourceLibraryIndexRow } from "@/server/modules/documents/document.types";

test("source library index keeps a single recent-7-days source view", () => {
  const now = new Date("2026-03-28T12:00:00.000Z");
  const groups = buildSourceLibraryIndexGroups(
    [
      createIndexRow({
        createdAt: "2026-03-28T06:30:00.000Z",
        feed: {
          id: "feed-1",
          title: "Kai Dispatch",
        },
      }),
      createIndexRow({
        createdAt: "2026-03-24T08:30:00.000Z",
        canonicalUrl: "https://example.com/article",
        sourceUrl: "https://example.com/article",
      }),
      createIndexRow({
        createdAt: "2026-03-10T08:30:00.000Z",
        canonicalUrl: "https://archive.example.com/article",
        sourceUrl: "https://archive.example.com/article",
      }),
    ],
    now,
  );

  assert.deepEqual(
    groups.map((group) => ({
      href: group.href,
      id: group.id,
      kind: group.kind,
      label: group.label,
      value: group.value,
    })),
    [
      {
        href: "/sources/feed/feed-1",
        id: "source:feed:feed-1",
        kind: "feed",
        label: "Kai Dispatch",
        value: "feed-1",
      },
      {
        href: "/sources/domain/example.com",
        id: "source:domain:example.com",
        kind: "domain",
        label: "example.com",
        value: "example.com",
      },
    ],
  );
});

test("source library index sorts groups by latest arrival by default", () => {
  const now = new Date("2026-03-28T12:00:00.000Z");
  const groups = buildSourceLibraryIndexGroups(
    [
      createIndexRow({
        createdAt: "2026-03-28T09:30:00.000Z",
        canonicalUrl: "https://later.example.com/post-1",
        sourceUrl: "https://later.example.com/post-1",
      }),
      createIndexRow({
        createdAt: "2026-03-28T08:30:00.000Z",
        canonicalUrl: "https://earlier.example.com/post-1",
        sourceUrl: "https://earlier.example.com/post-1",
      }),
    ],
    now,
    {},
    "latest",
  );

  assert.deepEqual(groups.map((group) => group.id), ["source:domain:later.example.com", "source:domain:earlier.example.com"]);
});

test("source library index supports earliest-first source ordering", () => {
  const now = new Date("2026-03-28T12:00:00.000Z");
  const groups = buildSourceLibraryIndexGroups(
    [
      createIndexRow({
        createdAt: "2026-03-28T09:30:00.000Z",
        canonicalUrl: "https://later.example.com/post-1",
        sourceUrl: "https://later.example.com/post-1",
      }),
      createIndexRow({
        createdAt: "2026-03-28T08:30:00.000Z",
        canonicalUrl: "https://earlier.example.com/post-1",
        sourceUrl: "https://earlier.example.com/post-1",
      }),
    ],
    now,
    {},
    "earliest",
  );

  assert.deepEqual(groups.map((group) => group.id), ["source:domain:earlier.example.com", "source:domain:later.example.com"]);
});

test("source library index prefers feed title and falls back to hostname", () => {
  const now = new Date("2026-03-28T12:00:00.000Z");
  const groups = buildSourceLibraryIndexGroups(
    [
      createIndexRow({
        createdAt: "2026-03-28T10:10:00.000Z",
        feed: {
          id: "feed-1",
          title: "Kai Dispatch",
        },
        canonicalUrl: "https://mp.weixin.qq.com/s/story-1",
        sourceUrl: "https://mp.weixin.qq.com/s/story-1",
      }),
      createIndexRow({
        createdAt: "2026-03-28T08:10:00.000Z",
        feed: {
          id: "feed-1",
          title: "Kai Dispatch",
        },
        canonicalUrl: "https://mp.weixin.qq.com/s/story-2",
        sourceUrl: "https://mp.weixin.qq.com/s/story-2",
      }),
      createIndexRow({
        createdAt: "2026-03-28T09:10:00.000Z",
        canonicalUrl: "https://sspai.com/post/123",
        sourceUrl: "https://sspai.com/post/123",
      }),
    ],
    now,
  );

  assert.deepEqual(
    groups.map((group) => ({
      href: group.href,
      id: group.id,
      kind: group.kind,
      label: group.label,
      meta: group.meta,
      totalItems: group.totalItems,
      value: group.value,
    })),
    [
      {
        href: "/sources/feed/feed-1",
        id: "source:feed:feed-1",
        kind: "feed",
        label: "Kai Dispatch",
        meta: "2 篇文章",
        totalItems: 2,
        value: "feed-1",
      },
      {
        href: "/sources/domain/sspai.com",
        id: "source:domain:sspai.com",
        kind: "domain",
        label: "sspai.com",
        meta: "1 篇文章",
        totalItems: 1,
        value: "sspai.com",
      },
    ],
  );
});

test("source aliases override displayed source labels without changing source identity", () => {
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
  const groups = buildSourceLibraryIndexGroups(
    [
      createIndexRow({
        createdAt: "2026-03-28T10:10:00.000Z",
        feed: {
          id: "feed-1",
          title: "Kai Dispatch",
        },
        canonicalUrl: "https://mp.weixin.qq.com/s/story-1",
        sourceUrl: "https://mp.weixin.qq.com/s/story-1",
      }),
      createIndexRow({
        createdAt: "2026-03-28T09:10:00.000Z",
        canonicalUrl: "https://mp.weixin.qq.com/s/story-2",
        sourceUrl: "https://mp.weixin.qq.com/s/story-2",
      }),
    ],
    now,
    aliasMap,
  );

  assert.deepEqual(
    groups.map((group) => ({
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

test("source library index keeps one top-level source card based on the latest recent arrival", () => {
  const now = new Date("2026-03-28T12:00:00.000Z");
  const groups = buildSourceLibraryIndexGroups(
    [
      createIndexRow({
        createdAt: "2026-03-28T10:10:00.000Z",
        feed: {
          id: "feed-1",
          title: "Kai Dispatch",
        },
        canonicalUrl: "https://mp.weixin.qq.com/s/story-1",
        sourceUrl: "https://mp.weixin.qq.com/s/story-1",
      }),
      createIndexRow({
        createdAt: "2026-03-24T10:10:00.000Z",
        feed: {
          id: "feed-1",
          title: "Kai Dispatch",
        },
        canonicalUrl: "https://mp.weixin.qq.com/s/story-2",
        sourceUrl: "https://mp.weixin.qq.com/s/story-2",
      }),
      createIndexRow({
        createdAt: "2026-03-24T09:10:00.000Z",
        canonicalUrl: "https://sspai.com/post/123",
        sourceUrl: "https://sspai.com/post/123",
      }),
    ],
    now,
  );

  assert.deepEqual(
    groups.map((group) => ({
      id: group.id,
      latestCreatedAt: group.latestCreatedAt,
      meta: group.meta,
      totalItems: group.totalItems,
    })),
    [
      {
        id: "source:feed:feed-1",
        latestCreatedAt: "2026-03-28T10:10:00.000Z",
        meta: "2 篇文章",
        totalItems: 2,
      },
      {
        id: "source:domain:sspai.com",
        latestCreatedAt: "2026-03-24T09:10:00.000Z",
        meta: "1 篇文章",
        totalItems: 1,
      },
    ],
  );
});

test("explicit source metadata overrides feed and domain inference in source index groups", () => {
  const now = new Date("2026-03-28T12:00:00.000Z");
  const groups = buildSourceLibraryIndexGroups(
    [
      createIndexRow({
        createdAt: "2026-03-28T10:10:00.000Z",
        canonicalUrl: "https://mp.weixin.qq.com/s/story-1",
        sourceUrl: "https://mp.weixin.qq.com/s/story-1",
        source: {
          id: "source-qbian",
          title: "请辩",
          includeCategories: ["Technology", "Policy", "Culture"],
        },
      }),
      createIndexRow({
        createdAt: "2026-03-28T09:10:00.000Z",
        canonicalUrl: "https://mp.weixin.qq.com/s/story-2",
        sourceUrl: "https://mp.weixin.qq.com/s/story-2",
        source: {
          id: "source-other",
          title: "另一份来源",
          includeCategories: [],
        },
      }),
    ],
    now,
  );

  assert.deepEqual(
    groups.map((group) => ({
      filterSummary: group.filterSummary,
      href: group.href,
      id: group.id,
      kind: group.kind,
      label: group.label,
      value: group.value,
    })),
    [
      {
        filterSummary: "分类过滤 · Technology, Policy +1",
        href: "/sources/source-qbian",
        id: "source:source-qbian",
        kind: "source",
        label: "请辩",
        value: "source-qbian",
      },
      {
        filterSummary: null,
        href: "/sources/source-other",
        id: "source:source-other",
        kind: "source",
        label: "另一份来源",
        value: "source-other",
      },
    ],
  );
});

test("unknown sources stay grouped and navigate to the dedicated unknown source page", () => {
  const groups = buildSourceLibraryIndexGroups(
    [
      createIndexRow({
        createdAt: "2026-03-28T11:30:00.000Z",
        canonicalUrl: null,
        sourceUrl: null,
      }),
      createIndexRow({
        createdAt: "2026-03-28T10:30:00.000Z",
        canonicalUrl: null,
        sourceUrl: null,
      }),
    ],
    new Date("2026-03-28T12:00:00.000Z"),
  );

  assert.equal(groups[0]?.id, "source:unknown");
  assert.equal(groups[0]?.label, "未知来源");
  assert.equal(groups[0]?.kind, "unknown");
  assert.equal(groups[0]?.value, null);
  assert.equal(groups[0]?.href, "/sources/unknown");
  assert.equal(groups[0]?.meta, "2 篇文章");
  assert.equal(groups[0]?.totalItems, 2);
});

test("web pages with missing publishedAt still form domain source cards by createdAt recency", () => {
  const now = new Date("2026-03-28T12:00:00.000Z");
  const groups = buildSourceLibraryIndexGroups(
    [
      createIndexRow({
        createdAt: "2026-03-28T11:20:00.000Z",
        canonicalUrl: "https://sspai.com/post/1",
        sourceUrl: "https://sspai.com/post/1",
      }),
      createIndexRow({
        createdAt: "2026-03-28T10:10:00.000Z",
        canonicalUrl: "https://sspai.com/post/2",
        sourceUrl: "https://sspai.com/post/2",
      }),
      createIndexRow({
        createdAt: "2026-03-28T09:10:00.000Z",
        canonicalUrl: "https://example.com/article",
        sourceUrl: "https://example.com/article",
      }),
    ],
    now,
  );

  assert.deepEqual(
    groups.map((group) => ({
      href: group.href,
      id: group.id,
      kind: group.kind,
      label: group.label,
      value: group.value,
    })),
    [
      {
        href: "/sources/domain/sspai.com",
        id: "source:domain:sspai.com",
        kind: "domain",
        label: "sspai.com",
        value: "sspai.com",
      },
      {
        href: "/sources/domain/example.com",
        id: "source:domain:example.com",
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

function createIndexRow(overrides: Partial<SourceLibraryIndexRow> = {}): SourceLibraryIndexRow {
  return {
    createdAt: "2026-03-27T08:30:00.000Z",
    sourceUrl: "https://example.com/article",
    canonicalUrl: "https://example.com/article",
    source: null,
    feed: null,
    ...overrides,
  };
}
