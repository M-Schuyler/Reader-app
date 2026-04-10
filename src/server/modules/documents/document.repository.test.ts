import assert from "node:assert/strict";
import test from "node:test";
import { __documentRepositoryForTests, documentOriginRowArgs, sourceIndexRowArgs } from "./document.repository";

test("unknown source filter only matches documents with no source, no feed, and no URLs", () => {
  assert.deepEqual(__documentRepositoryForTests.buildDocumentSourceWhere({ kind: "unknown", value: null }), {
    sourceId: null,
    feedId: null,
    sourceUrl: null,
    canonicalUrl: null,
  });
});

test("source index rows only select the lightweight fields needed for homepage aggregation", () => {
  assert.deepEqual(Object.keys(sourceIndexRowArgs.select ?? {}).sort(), [
    "canonicalUrl",
    "createdAt",
    "feed",
    "source",
    "sourceUrl",
  ]);
  assert.equal("title" in (sourceIndexRowArgs.select ?? {}), false);
  assert.equal("excerpt" in (sourceIndexRowArgs.select ?? {}), false);
  assert.equal("content" in (sourceIndexRowArgs.select ?? {}), false);
  assert.equal("tags" in (sourceIndexRowArgs.select ?? {}), false);
});

test("document origin rows select persisted content-origin fields and the legacy fallback inputs", () => {
  assert.deepEqual(Object.keys(documentOriginRowArgs.select ?? {}).sort(), [
    "author",
    "canonicalUrl",
    "content",
    "contentOriginKey",
    "contentOriginLabel",
    "id",
    "sourceUrl",
  ]);
  assert.equal("title" in (documentOriginRowArgs.select ?? {}), false);
  assert.equal("excerpt" in (documentOriginRowArgs.select ?? {}), false);
  assert.equal("tags" in (documentOriginRowArgs.select ?? {}), false);
});

test("wechat content-origin backfill targets missing keys and suspicious persisted labels without retrying explicit unknown keys", () => {
  assert.deepEqual(__documentRepositoryForTests.buildWechatContentOriginBackfillWhere(), {
    type: "WEB_PAGE",
    OR: [
      {
        canonicalUrl: {
          startsWith: "https://mp.weixin.qq.com",
        },
      },
      {
        canonicalUrl: {
          startsWith: "http://mp.weixin.qq.com",
        },
      },
      {
        sourceUrl: {
          startsWith: "https://mp.weixin.qq.com",
        },
      },
      {
        sourceUrl: {
          startsWith: "http://mp.weixin.qq.com",
        },
      },
    ],
    AND: [
      {
        OR: [
          {
            contentOriginKey: null,
          },
          {
            contentOriginKey: "wechat:unknown",
          },
          {
            contentOriginKey: {
              not: "wechat:unknown",
            },
            contentOriginLabel: "未识别公众号",
          },
          {
            contentOriginKey: {
              not: "wechat:unknown",
            },
            author: {
              not: null,
            },
            contentOriginLabel: {
              not: null,
            },
          },
        ],
      },
    ],
  });

  assert.equal(
    __documentRepositoryForTests.isRepairableWechatContentOriginCandidate({
      author: "蔡垒磊",
      contentOriginKey: "wechat:biz:MzI0MDg5ODA2NQ==",
      contentOriginLabel: "蔡垒磊",
      canonicalUrl: "https://mp.weixin.qq.com/s?__biz=MzI0MDg5ODA2NQ==&mid=1&idx=1&sn=abc",
      sourceUrl: "https://mp.weixin.qq.com/s?__biz=MzI0MDg5ODA2NQ==&mid=1&idx=1&sn=abc",
    }),
    true,
  );
  assert.equal(
    __documentRepositoryForTests.isRepairableWechatContentOriginCandidate({
      author: "蔡垒磊",
      contentOriginKey: "wechat:biz:MzI0MDg5ODA2NQ==",
      contentOriginLabel: "请辩",
      canonicalUrl: "https://mp.weixin.qq.com/s?__biz=MzI0MDg5ODA2NQ==&mid=1&idx=1&sn=abc",
      sourceUrl: "https://mp.weixin.qq.com/s?__biz=MzI0MDg5ODA2NQ==&mid=1&idx=1&sn=abc",
    }),
    false,
  );
  assert.equal(
    __documentRepositoryForTests.isRepairableWechatContentOriginCandidate({
      author: "蔡垒磊",
      contentOriginKey: "wechat:unknown",
      contentOriginLabel: "未识别公众号",
      canonicalUrl: "https://mp.weixin.qq.com/s?__biz=MzI0MDg5ODA2NQ==&mid=1&idx=1&sn=abc",
      sourceUrl: "https://mp.weixin.qq.com/s?__biz=MzI0MDg5ODA2NQ==&mid=1&idx=1&sn=abc",
    }),
    true,
  );
  assert.equal(
    __documentRepositoryForTests.isRepairableWechatContentOriginCandidate({
      author: null,
      contentOriginKey: "wechat:unknown",
      contentOriginLabel: "未识别公众号",
      canonicalUrl: "https://mp.weixin.qq.com/s/unknown-demo",
      sourceUrl: "https://mp.weixin.qq.com/s/unknown-demo",
    }),
    false,
  );
});
