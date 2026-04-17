import assert from "node:assert/strict";
import test from "node:test";
import { AiSummaryStatus, DocumentType, IngestionStatus, PublishedAtKind, ReadState } from "@prisma/client";
import { getDocuments } from "./document.service";
import type { DocumentListRecord, DocumentOriginRowRecord } from "./document.repository";
import type { DocumentListQuery } from "./document.types";

test("getDocuments exposes wechat content-origin options and filters source detail results by the selected origin", async () => {
  const query = {
    surface: "source",
    source: {
      kind: "domain",
      value: "mp.weixin.qq.com",
    },
    page: 1,
    pageSize: 20,
    sort: "latest",
    enableContentOrigin: true,
  } as DocumentListQuery;

  const allItems = [
    createDocumentListRecord({
      id: "wechat-short-1",
      title: "请辩的短链接文章",
      sourceUrl: "https://mp.weixin.qq.com/s/u5b-5ihEDEIFvykN_HDZig",
      canonicalUrl: "https://mp.weixin.qq.com/s/u5b-5ihEDEIFvykN_HDZig",
    }),
    createDocumentListRecord({
      id: "wechat-biz-1",
      title: "请辩的完整链接文章",
      sourceUrl: "https://mp.weixin.qq.com/s?__biz=MzI0MDg5ODA2NQ==&mid=1&idx=1&sn=abc",
      canonicalUrl: "https://mp.weixin.qq.com/s?__biz=MzI0MDg5ODA2NQ==&mid=1&idx=1&sn=abc",
    }),
    createDocumentListRecord({
      id: "wechat-other-1",
      title: "别的公众号",
      sourceUrl: "https://mp.weixin.qq.com/s?__biz=MzIyMzA5NjEyMA==&mid=2&idx=1&sn=def",
      canonicalUrl: "https://mp.weixin.qq.com/s?__biz=MzIyMzA5NjEyMA==&mid=2&idx=1&sn=def",
    }),
  ];

  const originRows = [
    createOriginRow({
      id: "wechat-short-1",
      author: "请辩",
      canonicalUrl: "https://mp.weixin.qq.com/s/u5b-5ihEDEIFvykN_HDZig",
      contentOriginKey: null,
      contentOriginLabel: null,
      rawHtml: null,
      sourceUrl: "https://mp.weixin.qq.com/s/u5b-5ihEDEIFvykN_HDZig",
    }),
    createOriginRow({
      id: "wechat-biz-1",
      author: null,
      canonicalUrl: "https://mp.weixin.qq.com/s?__biz=MzI0MDg5ODA2NQ==&mid=1&idx=1&sn=abc",
      contentOriginKey: "wechat:biz:MzI0MDg5ODA2NQ==",
      contentOriginLabel: "请辩",
      rawHtml: "<script>var profile_nickname = \"请辩\";</script>",
      sourceUrl: "https://mp.weixin.qq.com/s?__biz=MzI0MDg5ODA2NQ==&mid=1&idx=1&sn=abc",
    }),
    createOriginRow({
      id: "wechat-other-1",
      author: null,
      canonicalUrl: "https://mp.weixin.qq.com/s?__biz=MzIyMzA5NjEyMA==&mid=2&idx=1&sn=def",
      contentOriginKey: "wechat:biz:MzIyMzA5NjEyMA==",
      contentOriginLabel: "别的号",
      rawHtml: null,
      sourceUrl: "https://mp.weixin.qq.com/s?__biz=MzIyMzA5NjEyMA==&mid=2&idx=1&sn=def",
    }),
  ];

  const unfiltered = await getDocuments(query, {
    listDocumentOriginRows: async () => originRows,
    listDocuments: async () => ({
      items: allItems,
      total: allItems.length,
    }),
    listDocumentsByIds: async (ids: string[]) => allItems.filter((item) => ids.includes(item.id)),
    listWechatSubsourcesByBiz: async () => [],
    warn: () => undefined,
  });

  assert.deepEqual(
    unfiltered.contentOrigin?.options.map((option: { count: number; label: string; value: string }) => ({
      count: option.count,
      label: option.label,
      value: option.value,
    })),
    [
      {
        count: 2,
        label: "请辩",
        value: "wechat:biz:MzI0MDg5ODA2NQ==",
      },
      {
        count: 1,
        label: "别的号",
        value: "wechat:biz:MzIyMzA5NjEyMA==",
      },
    ],
  );

  const filtered = await getDocuments(
    {
      ...query,
      origin: "wechat:biz:MzI0MDg5ODA2NQ==",
    },
    {
      listDocumentOriginRows: async () => originRows,
      listDocuments: async () => {
        throw new Error("origin-filtered source detail views should not use the paginated list query");
      },
      listDocumentsByIds: async (ids: string[]) => allItems.filter((item) => ids.includes(item.id)),
      listWechatSubsourcesByBiz: async () => [],
      warn: () => undefined,
    },
  );

  assert.equal(filtered.pagination.total, 2);
  assert.deepEqual(
    filtered.items.map((item: { id: string }) => item.id),
    ["wechat-short-1", "wechat-biz-1"],
  );
});

test("getDocuments keeps minority biz options separate while merging nickname-only rows into a clearly dominant biz option", async () => {
  const query = {
    surface: "source",
    source: {
      kind: "domain",
      value: "mp.weixin.qq.com",
    },
    page: 1,
    pageSize: 20,
    sort: "latest",
    enableContentOrigin: true,
  } as DocumentListQuery;

  const allItems = [
    createDocumentListRecord({
      id: "wechat-short-1",
      title: "蔡垒磊短链文章",
      sourceUrl: "https://mp.weixin.qq.com/s/short-link-1",
      canonicalUrl: "https://mp.weixin.qq.com/s/short-link-1",
    }),
    createDocumentListRecord({
      id: "wechat-dominant-biz-1",
      title: "蔡垒磊主号文章 1",
      sourceUrl: "https://mp.weixin.qq.com/s?__biz=MzDominant&mid=1&idx=1&sn=abc",
      canonicalUrl: "https://mp.weixin.qq.com/s?__biz=MzDominant&mid=1&idx=1&sn=abc",
    }),
    createDocumentListRecord({
      id: "wechat-dominant-biz-2",
      title: "蔡垒磊主号文章 2",
      sourceUrl: "https://mp.weixin.qq.com/s?__biz=MzDominant&mid=2&idx=1&sn=def",
      canonicalUrl: "https://mp.weixin.qq.com/s?__biz=MzDominant&mid=2&idx=1&sn=def",
    }),
    createDocumentListRecord({
      id: "wechat-dominant-biz-3",
      title: "蔡垒磊主号文章 3",
      sourceUrl: "https://mp.weixin.qq.com/s?__biz=MzDominant&mid=3&idx=1&sn=ghi",
      canonicalUrl: "https://mp.weixin.qq.com/s?__biz=MzDominant&mid=3&idx=1&sn=ghi",
    }),
    createDocumentListRecord({
      id: "wechat-minority-biz-1",
      title: "蔡垒磊少数派号文章",
      sourceUrl: "https://mp.weixin.qq.com/s?__biz=MzMinority&mid=4&idx=1&sn=jkl",
      canonicalUrl: "https://mp.weixin.qq.com/s?__biz=MzMinority&mid=4&idx=1&sn=jkl",
    }),
  ];

  const originRows = [
    createOriginRow({
      id: "wechat-short-1",
      author: "蔡垒磊",
      canonicalUrl: "https://mp.weixin.qq.com/s/short-link-1",
      contentOriginKey: "wechat:nickname:蔡垒磊",
      contentOriginLabel: "蔡垒磊",
      rawHtml: null,
      sourceUrl: "https://mp.weixin.qq.com/s/short-link-1",
    }),
    createOriginRow({
      id: "wechat-dominant-biz-1",
      author: null,
      canonicalUrl: "https://mp.weixin.qq.com/s?__biz=MzDominant&mid=1&idx=1&sn=abc",
      contentOriginKey: "wechat:biz:MzDominant",
      contentOriginLabel: "蔡垒磊",
      rawHtml: null,
      sourceUrl: "https://mp.weixin.qq.com/s?__biz=MzDominant&mid=1&idx=1&sn=abc",
    }),
    createOriginRow({
      id: "wechat-dominant-biz-2",
      author: null,
      canonicalUrl: "https://mp.weixin.qq.com/s?__biz=MzDominant&mid=2&idx=1&sn=def",
      contentOriginKey: "wechat:biz:MzDominant",
      contentOriginLabel: "蔡垒磊",
      rawHtml: null,
      sourceUrl: "https://mp.weixin.qq.com/s?__biz=MzDominant&mid=2&idx=1&sn=def",
    }),
    createOriginRow({
      id: "wechat-dominant-biz-3",
      author: null,
      canonicalUrl: "https://mp.weixin.qq.com/s?__biz=MzDominant&mid=3&idx=1&sn=ghi",
      contentOriginKey: "wechat:biz:MzDominant",
      contentOriginLabel: "蔡垒磊",
      rawHtml: null,
      sourceUrl: "https://mp.weixin.qq.com/s?__biz=MzDominant&mid=3&idx=1&sn=ghi",
    }),
    createOriginRow({
      id: "wechat-minority-biz-1",
      author: null,
      canonicalUrl: "https://mp.weixin.qq.com/s?__biz=MzMinority&mid=4&idx=1&sn=jkl",
      contentOriginKey: "wechat:biz:MzMinority",
      contentOriginLabel: "蔡垒磊",
      rawHtml: null,
      sourceUrl: "https://mp.weixin.qq.com/s?__biz=MzMinority&mid=4&idx=1&sn=jkl",
    }),
  ];

  const result = await getDocuments(query, {
    listDocumentOriginRows: async () => originRows,
    listDocuments: async () => ({
      items: allItems,
      total: allItems.length,
    }),
    listDocumentsByIds: async (ids: string[]) => allItems.filter((item) => ids.includes(item.id)),
    listWechatSubsourcesByBiz: async () => [],
    warn: () => undefined,
  });

  assert.deepEqual(
    result.contentOrigin?.options.map((option: { count: number; label: string; value: string }) => ({
      count: option.count,
      label: option.label,
      value: option.value,
    })),
    [
      {
        count: 4,
        label: "蔡垒磊",
        value: "wechat:biz:MzDominant",
      },
      {
        count: 1,
        label: "蔡垒磊",
        value: "wechat:biz:MzMinority",
      },
    ],
  );

  const filtered = await getDocuments(
    {
      ...query,
      origin: "wechat:biz:MzDominant",
    },
    {
      listDocumentOriginRows: async () => originRows,
      listDocuments: async () => {
        throw new Error("origin-filtered source detail views should not use the paginated list query");
      },
      listDocumentsByIds: async (ids: string[]) => allItems.filter((item) => ids.includes(item.id)),
      listWechatSubsourcesByBiz: async () => [],
      warn: () => undefined,
    },
  );

  assert.deepEqual(
    filtered.items.map((item: { id: string }) => item.id),
    ["wechat-short-1", "wechat-dominant-biz-1", "wechat-dominant-biz-2", "wechat-dominant-biz-3"],
  );
});

test("getDocuments prefers registry display names for wechat biz filter options over persisted labels", async () => {
  const query = {
    surface: "source",
    source: {
      kind: "domain",
      value: "mp.weixin.qq.com",
    },
    page: 1,
    pageSize: 20,
    sort: "latest",
    enableContentOrigin: true,
  } as DocumentListQuery;

  const allItems = [
    createDocumentListRecord({
      id: "wechat-biz-1",
      title: "请辩文章",
      sourceUrl: "https://mp.weixin.qq.com/s?__biz=MzI0MDg5ODA2NQ==&mid=1&idx=1&sn=abc",
      canonicalUrl: "https://mp.weixin.qq.com/s?__biz=MzI0MDg5ODA2NQ==&mid=1&idx=1&sn=abc",
    }),
  ];

  const originRows = [
    createOriginRow({
      id: "wechat-biz-1",
      author: "蔡垒磊",
      canonicalUrl: "https://mp.weixin.qq.com/s?__biz=MzI0MDg5ODA2NQ==&mid=1&idx=1&sn=abc",
      contentOriginKey: "wechat:biz:MzI0MDg5ODA2NQ==",
      contentOriginLabel: "蔡垒磊",
      rawHtml: null,
      sourceUrl: "https://mp.weixin.qq.com/s?__biz=MzI0MDg5ODA2NQ==&mid=1&idx=1&sn=abc",
    }),
  ];

  const result = await getDocuments(query, {
    listDocumentOriginRows: async () => originRows,
    listDocuments: async () => ({
      items: allItems,
      total: allItems.length,
    }),
    listDocumentsByIds: async (ids: string[]) => allItems.filter((item) => ids.includes(item.id)),
    listWechatSubsourcesByBiz: async () => [
      {
        biz: "MzI0MDg5ODA2NQ==",
        displayName: "请辩",
        isPlaceholder: false,
        createdAt: new Date("2026-04-10T00:00:00.000Z"),
        updatedAt: new Date("2026-04-10T00:00:00.000Z"),
      },
    ],
    warn: () => undefined,
  });

  assert.deepEqual(result.contentOrigin?.options, [
    {
      value: "wechat:biz:MzI0MDg5ODA2NQ==",
      label: "请辩",
      count: 1,
    },
  ]);
});

test("getDocuments does not run content-origin aggregation for non-wechat source detail queries unless explicitly enabled", async () => {
  const query = {
    surface: "source",
    source: {
      kind: "domain",
      value: "example.com",
    },
    page: 1,
    pageSize: 20,
    sort: "latest",
  } as DocumentListQuery;

  const allItems = [
    createDocumentListRecord({
      id: "web-1",
      title: "普通网页",
      sourceUrl: "https://example.com/article",
      canonicalUrl: "https://example.com/article",
    }),
  ];

  let listOriginRowsCalls = 0;

  const result = await getDocuments(query, {
    listDocumentOriginRows: async () => {
      listOriginRowsCalls += 1;
      throw new Error("non-wechat detail queries must not trigger content-origin aggregation");
    },
    listDocuments: async () => ({
      items: allItems,
      total: allItems.length,
    }),
    listDocumentsByIds: async () => {
      throw new Error("non-origin-filtered queries should use the paginated document list");
    },
    warn: () => undefined,
  });

  assert.equal(listOriginRowsCalls, 0);
  assert.equal(result.contentOrigin, undefined);
  assert.deepEqual(result.items.map((item) => item.id), ["web-1"]);
});

function createDocumentListRecord(overrides: Partial<DocumentListRecord>): DocumentListRecord {
  return {
    id: "document-1",
    type: DocumentType.WEB_PAGE,
    title: "示例文章",
    sourceUrl: "https://example.com/article",
    canonicalUrl: "https://example.com/article",
    videoUrl: null,
    videoProvider: null,
    videoThumbnailUrl: null,
    videoDurationSeconds: null,
    transcriptSegments: null,
    transcriptSource: null,
    transcriptStatus: null,
    dedupeKey: null,
    externalId: null,
    aiSummary: null,
    aiSummaryStatus: AiSummaryStatus.READY,
    aiSummaryError: null,
    excerpt: "摘要",
    lang: "zh-CN",
    author: null,
    contentOriginKey: null,
    contentOriginLabel: null,
    publishedAt: null,
    publishedAtKind: PublishedAtKind.UNKNOWN,
    enteredReadingAt: null,
    readState: ReadState.UNREAD,
    readingProgress: 0,
    isFavorite: false,
    ingestionStatus: IngestionStatus.READY,
    sourceId: null,
    feedId: null,
    createdAt: new Date("2026-04-07T07:20:38.081Z"),
    updatedAt: new Date("2026-04-07T07:20:38.081Z"),
    source: null,
    feed: null,
    content: {
      wordCount: 822,
    },
    tags: [],
    ...overrides,
  };
}

function createOriginRow(
  overrides: Partial<DocumentOriginRowRecord> & {
    contentOriginKey?: string | null;
    contentOriginLabel?: string | null;
    rawHtml?: string | null;
  },
): DocumentOriginRowRecord {
  const { rawHtml, ...rest } = overrides;

  return {
    id: "document-1",
    author: null,
    canonicalUrl: "https://example.com/article",
    content: {
      rawHtml: rawHtml ?? null,
    },
    sourceUrl: "https://example.com/article",
    ...rest,
  } as DocumentOriginRowRecord;
}
