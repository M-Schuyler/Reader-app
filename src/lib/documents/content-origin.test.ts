import assert from "node:assert/strict";
import test from "node:test";
import { buildContentOriginIndex, deriveContentOriginMetadata } from "./content-origin";

test("deriveContentOriginMetadata resolves wechat biz origins from metadata and raw html", () => {
  const result = deriveContentOriginMetadata({
    author: "请辩",
    canonicalUrl: "https://mp.weixin.qq.com/s?__biz=MzI0MDg5ODA2NQ==&mid=1&idx=1&sn=abc",
    finalUrl: "https://mp.weixin.qq.com/s?__biz=MzI0MDg5ODA2NQ==&mid=1&idx=1&sn=abc",
    rawHtml: "<script>var profile_nickname = \"请辩\";</script>",
    sourceUrl: "https://mp.weixin.qq.com/s/u5b-5ihEDEIFvykN_HDZig",
  });

  assert.deepEqual(result, {
    isWechat: true,
    key: "wechat:biz:MzI0MDg5ODA2NQ==",
    label: "请辩",
  });
});

test("deriveContentOriginMetadata prefers the wechat account name over the article author", () => {
  const result = deriveContentOriginMetadata({
    author: "蔡垒磊",
    canonicalUrl: "https://mp.weixin.qq.com/s?__biz=MzI0MDg5ODA2NQ==&mid=1&idx=1&sn=abc",
    sourceUrl: "https://mp.weixin.qq.com/s/pretty-link",
    wechatAccountName: "请辩",
  });

  assert.deepEqual(result, {
    isWechat: true,
    key: "wechat:biz:MzI0MDg5ODA2NQ==",
    label: "请辩",
  });
});

test("buildContentOriginIndex prefers persisted origins but still falls back to rawHtml and author for pre-backfill wechat rows", () => {
  const result = buildContentOriginIndex([
    {
      id: "wechat-biz-1",
      author: null,
      canonicalUrl: "https://mp.weixin.qq.com/s?__biz=MzI0MDg5ODA2NQ==&mid=1&idx=1&sn=abc",
      contentOriginKey: "wechat:biz:MzI0MDg5ODA2NQ==",
      contentOriginLabel: "请辩",
      rawHtml: "<script>var profile_nickname = \"请辩\";</script>",
      sourceUrl: "https://mp.weixin.qq.com/s?__biz=MzI0MDg5ODA2NQ==&mid=1&idx=1&sn=abc",
    },
    {
      id: "wechat-short-1",
      author: "请辩",
      canonicalUrl: "https://mp.weixin.qq.com/s/u5b-5ihEDEIFvykN_HDZig",
      contentOriginKey: null,
      contentOriginLabel: null,
      rawHtml: null,
      sourceUrl: "https://mp.weixin.qq.com/s/u5b-5ihEDEIFvykN_HDZig",
    },
    {
      id: "wechat-unknown",
      author: null,
      canonicalUrl: "https://mp.weixin.qq.com/s/unknown-demo",
      contentOriginKey: "wechat:unknown",
      contentOriginLabel: "未识别公众号",
      rawHtml: null,
      sourceUrl: "https://mp.weixin.qq.com/s/unknown-demo",
    },
  ]);

  assert.deepEqual(
    result.options.map((option) => ({
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
        label: "未识别公众号",
        value: "wechat:unknown",
      },
    ],
  );

  assert.equal(result.documentOriginById["wechat-short-1"], "wechat:biz:MzI0MDg5ODA2NQ==");
});

test("buildContentOriginIndex merges nickname-only rows into the dominant biz when one biz clearly leads for that nickname", () => {
  const result = buildContentOriginIndex([
    {
      id: "wechat-dominant-biz-1",
      author: null,
      canonicalUrl: "https://mp.weixin.qq.com/s?__biz=MzDominant&mid=1&idx=1&sn=abc",
      contentOriginKey: "wechat:biz:MzDominant",
      contentOriginLabel: "蔡垒磊",
      rawHtml: null,
      sourceUrl: "https://mp.weixin.qq.com/s?__biz=MzDominant&mid=1&idx=1&sn=abc",
    },
    {
      id: "wechat-dominant-biz-2",
      author: null,
      canonicalUrl: "https://mp.weixin.qq.com/s?__biz=MzDominant&mid=2&idx=1&sn=def",
      contentOriginKey: "wechat:biz:MzDominant",
      contentOriginLabel: "蔡垒磊",
      rawHtml: null,
      sourceUrl: "https://mp.weixin.qq.com/s?__biz=MzDominant&mid=2&idx=1&sn=def",
    },
    {
      id: "wechat-dominant-biz-3",
      author: null,
      canonicalUrl: "https://mp.weixin.qq.com/s?__biz=MzDominant&mid=3&idx=1&sn=ghi",
      contentOriginKey: "wechat:biz:MzDominant",
      contentOriginLabel: "蔡垒磊",
      rawHtml: null,
      sourceUrl: "https://mp.weixin.qq.com/s?__biz=MzDominant&mid=3&idx=1&sn=ghi",
    },
    {
      id: "wechat-minority-biz-1",
      author: null,
      canonicalUrl: "https://mp.weixin.qq.com/s?__biz=MzMinority&mid=4&idx=1&sn=jkl",
      contentOriginKey: "wechat:biz:MzMinority",
      contentOriginLabel: "蔡垒磊",
      rawHtml: null,
      sourceUrl: "https://mp.weixin.qq.com/s?__biz=MzMinority&mid=4&idx=1&sn=jkl",
    },
    {
      id: "wechat-short-1",
      author: "蔡垒磊",
      canonicalUrl: "https://mp.weixin.qq.com/s/short-link-1",
      contentOriginKey: "wechat:nickname:蔡垒磊",
      contentOriginLabel: "蔡垒磊",
      rawHtml: null,
      sourceUrl: "https://mp.weixin.qq.com/s/short-link-1",
    },
  ]);

  assert.equal(result.documentOriginById["wechat-short-1"], "wechat:biz:MzDominant");
  assert.deepEqual(
    result.options.map((option) => ({
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
});

test("buildContentOriginIndex keeps nickname-only rows separate when same nickname maps to multiple biz values without a dominant leader", () => {
  const result = buildContentOriginIndex([
    {
      id: "wechat-biz-a-1",
      author: null,
      canonicalUrl: "https://mp.weixin.qq.com/s?__biz=MzEqualA&mid=1&idx=1&sn=abc",
      contentOriginKey: "wechat:biz:MzEqualA",
      contentOriginLabel: "蔡垒磊",
      rawHtml: null,
      sourceUrl: "https://mp.weixin.qq.com/s?__biz=MzEqualA&mid=1&idx=1&sn=abc",
    },
    {
      id: "wechat-biz-a-2",
      author: null,
      canonicalUrl: "https://mp.weixin.qq.com/s?__biz=MzEqualA&mid=2&idx=1&sn=def",
      contentOriginKey: "wechat:biz:MzEqualA",
      contentOriginLabel: "蔡垒磊",
      rawHtml: null,
      sourceUrl: "https://mp.weixin.qq.com/s?__biz=MzEqualA&mid=2&idx=1&sn=def",
    },
    {
      id: "wechat-biz-b-1",
      author: null,
      canonicalUrl: "https://mp.weixin.qq.com/s?__biz=MzEqualB&mid=3&idx=1&sn=ghi",
      contentOriginKey: "wechat:biz:MzEqualB",
      contentOriginLabel: "蔡垒磊",
      rawHtml: null,
      sourceUrl: "https://mp.weixin.qq.com/s?__biz=MzEqualB&mid=3&idx=1&sn=ghi",
    },
    {
      id: "wechat-biz-b-2",
      author: null,
      canonicalUrl: "https://mp.weixin.qq.com/s?__biz=MzEqualB&mid=4&idx=1&sn=jkl",
      contentOriginKey: "wechat:biz:MzEqualB",
      contentOriginLabel: "蔡垒磊",
      rawHtml: null,
      sourceUrl: "https://mp.weixin.qq.com/s?__biz=MzEqualB&mid=4&idx=1&sn=jkl",
    },
    {
      id: "wechat-short-2",
      author: "蔡垒磊",
      canonicalUrl: "https://mp.weixin.qq.com/s/short-link-2",
      contentOriginKey: "wechat:nickname:蔡垒磊",
      contentOriginLabel: "蔡垒磊",
      rawHtml: null,
      sourceUrl: "https://mp.weixin.qq.com/s/short-link-2",
    },
  ]);

  assert.equal(result.documentOriginById["wechat-short-2"], "wechat:nickname:蔡垒磊");
  assert.deepEqual(
    result.options.map((option) => ({
      count: option.count,
      label: option.label,
      value: option.value,
    })),
    [
      {
        count: 2,
        label: "蔡垒磊",
        value: "wechat:biz:MzEqualA",
      },
      {
        count: 2,
        label: "蔡垒磊",
        value: "wechat:biz:MzEqualB",
      },
      {
        count: 1,
        label: "蔡垒磊",
        value: "wechat:nickname:蔡垒磊",
      },
    ],
  );
});
