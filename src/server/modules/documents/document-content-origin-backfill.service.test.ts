import assert from "node:assert/strict";
import test from "node:test";
import { backfillWechatContentOrigins } from "./document-content-origin-backfill.service";

test("backfillWechatContentOrigins marks a document as unknown after the fourth consecutive metadata failure in the same run", async () => {
  const updates: Array<{
    documentId: string;
    input: {
      author?: string | null;
      contentOriginKey: string;
      contentOriginLabel: string;
    };
  }> = [];
  let fetchCount = 0;

  const result = await backfillWechatContentOrigins(10, {
    fetchMetadata: async () => {
      fetchCount += 1;
      throw new Error("wechat blocked");
    },
    listCandidates: async () => ({
      items: [
        {
          author: null,
          canonicalUrl: "https://mp.weixin.qq.com/s/example",
          contentOriginKey: null,
          contentOriginLabel: null,
          id: "doc-1",
          sourceUrl: "https://mp.weixin.qq.com/s/example",
        },
      ],
      hasMore: false,
    }),
    updateDocumentOrigin: async (
      documentId: string,
      input: {
        author?: string | null;
        contentOriginKey: string;
        contentOriginLabel: string;
      },
    ) => {
      updates.push({
        documentId,
        input,
      });
    },
  });

  assert.deepEqual(result, {
    failed: 1,
    hasMore: false,
    scanned: 1,
    updated: 0,
  });
  assert.equal(fetchCount, 4);
  assert.deepEqual(updates, [
    {
      documentId: "doc-1",
      input: {
        contentOriginKey: "wechat:unknown",
        contentOriginLabel: "未识别公众号",
      },
    },
  ]);
});

test("backfillWechatContentOrigins fills missing author only when metadata provides it and the document currently lacks it", async () => {
  const updates: Array<{
    documentId: string;
    input: {
      author?: string | null;
      contentOriginKey: string;
      contentOriginLabel: string;
    };
  }> = [];
  const subsourceCalls: Array<{
    biz: string;
    displayName?: string | null;
  }> = [];

  const result = await backfillWechatContentOrigins(10, {
    fetchMetadata: async () => ({
      author: "蔡垒磊",
      canonicalUrl: "https://mp.weixin.qq.com/s?__biz=MzI0MDg5ODA2NQ==&mid=1&idx=1&sn=abc",
      finalUrl: "https://mp.weixin.qq.com/s?__biz=MzI0MDg5ODA2NQ==&mid=1&idx=1&sn=abc",
      publishedAt: null,
      wechatAccountName: "请辩",
    }),
    listCandidates: async () => ({
      items: [
        {
          author: null,
          canonicalUrl: "https://mp.weixin.qq.com/s/example",
          contentOriginKey: null,
          contentOriginLabel: null,
          id: "doc-1",
          sourceUrl: "https://mp.weixin.qq.com/s/example",
        },
      ],
      hasMore: false,
    }),
    updateDocumentOrigin: async (
      documentId: string,
      input: {
        author?: string | null;
        contentOriginKey: string;
        contentOriginLabel: string;
      },
    ) => {
      updates.push({
        documentId,
        input,
      });
    },
    upsertWechatSubsource: async (input: { biz: string; displayName?: string | null }) => {
      subsourceCalls.push(input);
      return {
        biz: input.biz,
        displayName: input.displayName ?? "请辩",
        isPlaceholder: input.displayName === null || typeof input.displayName === "undefined",
        createdAt: new Date("2026-04-10T00:00:00.000Z"),
        updatedAt: new Date("2026-04-10T00:00:00.000Z"),
      };
    },
  });

  assert.deepEqual(result, {
    failed: 0,
    hasMore: false,
    scanned: 1,
    updated: 1,
  });
  assert.deepEqual(subsourceCalls, [
    {
      biz: "MzI0MDg5ODA2NQ==",
      displayName: "请辩",
    },
  ]);
  assert.deepEqual(updates, [
    {
      documentId: "doc-1",
      input: {
        author: "蔡垒磊",
        contentOriginKey: "wechat:biz:MzI0MDg5ODA2NQ==",
        contentOriginLabel: "请辩",
      },
    },
  ]);
});

test("backfillWechatContentOrigins repairs a polluted biz label before retrying fetches when the URL already yields the same biz", async () => {
  const trace: string[] = [];
  const updates: Array<{
    documentId: string;
    input: {
      author?: string | null;
      contentOriginKey: string;
      contentOriginLabel: string;
    };
  }> = [];
  const subsourceCalls: Array<{
    biz: string;
    displayName?: string | null;
  }> = [];
  let fetchCount = 0;

  const result = await backfillWechatContentOrigins(10, {
    fetchMetadata: async () => {
      fetchCount += 1;
      trace.push(`fetch:${fetchCount}`);
      throw new Error("wechat blocked");
    },
    listCandidates: async () => ({
      items: [
        {
          author: null,
          canonicalUrl: "https://mp.weixin.qq.com/s?__biz=MzI0MDg5ODA2NQ==&mid=1&idx=1&sn=abc",
          contentOriginKey: "wechat:biz:MzI0MDg5ODA2NQ==",
          contentOriginLabel: "蔡垒磊",
          id: "doc-1",
          sourceUrl: "https://mp.weixin.qq.com/s?__biz=MzI0MDg5ODA2NQ==&mid=1&idx=1&sn=abc",
        },
      ],
      hasMore: false,
    }),
    updateDocumentOrigin: async (
      documentId: string,
      input: {
        author?: string | null;
        contentOriginKey: string;
        contentOriginLabel: string;
      },
    ) => {
      trace.push("update");
      updates.push({
        documentId,
        input,
      });
    },
    upsertWechatSubsource: async (input: { biz: string; displayName?: string | null }) => {
      trace.push("upsert");
      subsourceCalls.push(input);
      return {
        biz: input.biz,
        displayName: "请辩",
        isPlaceholder: false,
        createdAt: new Date("2026-04-10T00:00:00.000Z"),
        updatedAt: new Date("2026-04-10T00:00:00.000Z"),
      };
    },
  } as any);

  assert.deepEqual(result, {
    failed: 1,
    hasMore: false,
    scanned: 1,
    updated: 1,
  });
  assert.equal(fetchCount, 4);
  assert.deepEqual(trace, ["upsert", "update", "fetch:1", "fetch:2", "fetch:3", "fetch:4"]);
  assert.deepEqual(subsourceCalls, [
    {
      biz: "MzI0MDg5ODA2NQ==",
      displayName: null,
    },
  ]);
  assert.deepEqual(updates, [
    {
      documentId: "doc-1",
      input: {
        contentOriginKey: "wechat:biz:MzI0MDg5ODA2NQ==",
        contentOriginLabel: "请辩",
      },
    },
  ]);
});

test("backfillWechatContentOrigins keeps a known WeChat biz identity even when metadata fetch keeps failing", async () => {
  const updates: Array<{
    documentId: string;
    input: {
      author?: string | null;
      contentOriginKey: string;
      contentOriginLabel: string;
    };
  }> = [];
  const subsourceCalls: Array<{
    biz: string;
    displayName?: string | null;
  }> = [];

  const result = await backfillWechatContentOrigins(10, {
    fetchMetadata: async () => {
      throw new Error("wechat blocked");
    },
    listCandidates: async () => ({
      items: [
        {
          author: null,
          canonicalUrl: "https://mp.weixin.qq.com/s?__biz=MzI0MDg5ODA2NQ==&mid=1&idx=1&sn=abc",
          contentOriginKey: null,
          contentOriginLabel: null,
          id: "doc-1",
          sourceUrl: "https://mp.weixin.qq.com/s?__biz=MzI0MDg5ODA2NQ==&mid=1&idx=1&sn=abc",
        },
      ],
      hasMore: false,
    }),
    updateDocumentOrigin: async (
      documentId: string,
      input: {
        author?: string | null;
        contentOriginKey: string;
        contentOriginLabel: string;
      },
    ) => {
      updates.push({
        documentId,
        input,
      });
    },
    upsertWechatSubsource: async (input: { biz: string; displayName?: string | null }) => {
      subsourceCalls.push(input);
      return {
        biz: input.biz,
        displayName: input.displayName?.trim() || "未命名公众号 MzI0MD…",
        isPlaceholder: !input.displayName,
        createdAt: new Date("2026-04-10T00:00:00.000Z"),
        updatedAt: new Date("2026-04-10T00:00:00.000Z"),
      };
    },
  } as any);

  assert.deepEqual(result, {
    failed: 1,
    hasMore: false,
    scanned: 1,
    updated: 1,
  });
  assert.deepEqual(subsourceCalls, [
    {
      biz: "MzI0MDg5ODA2NQ==",
      displayName: null,
    },
  ]);
  assert.deepEqual(updates, [
    {
      documentId: "doc-1",
      input: {
        contentOriginKey: "wechat:biz:MzI0MDg5ODA2NQ==",
        contentOriginLabel: "未命名公众号 MzI0MD…",
      },
    },
  ]);
});

test("backfillWechatContentOrigins does not downgrade an existing wechat content-origin key when repair fetches keep failing", async () => {
  const updates: Array<{
    documentId: string;
    input: {
      author?: string | null;
      contentOriginKey: string;
      contentOriginLabel: string;
    };
  }> = [];
  const subsourceCalls: Array<{
    biz: string;
    displayName?: string | null;
  }> = [];

  const result = await backfillWechatContentOrigins(10, {
    fetchMetadata: async () => {
      throw new Error("wechat blocked");
    },
    listCandidates: async () => ({
      items: [
        {
          author: "蔡垒磊",
          canonicalUrl: "https://mp.weixin.qq.com/s?__biz=MzI0MDg5ODA2NQ==&mid=1&idx=1&sn=abc",
          contentOriginKey: "wechat:biz:MzI0MDg5ODA2NQ==",
          contentOriginLabel: "蔡垒磊",
          id: "doc-1",
          sourceUrl: "https://mp.weixin.qq.com/s/pretty-link",
        },
      ],
      hasMore: false,
    }),
    updateDocumentOrigin: async (
      documentId: string,
      input: {
        author?: string | null;
        contentOriginKey: string;
        contentOriginLabel: string;
      },
    ) => {
      updates.push({
        documentId,
        input,
      });
    },
    upsertWechatSubsource: async (input: { biz: string; displayName?: string | null }) => {
      subsourceCalls.push(input);
      return {
        biz: input.biz,
        displayName: input.displayName ?? "蔡垒磊",
        isPlaceholder: input.displayName === null || typeof input.displayName === "undefined",
        createdAt: new Date("2026-04-10T00:00:00.000Z"),
        updatedAt: new Date("2026-04-10T00:00:00.000Z"),
      };
    },
  });

  assert.deepEqual(result, {
    failed: 1,
    hasMore: false,
    scanned: 1,
    updated: 0,
  });
  assert.deepEqual(subsourceCalls, [
    {
      biz: "MzI0MDg5ODA2NQ==",
      displayName: null,
    },
  ]);
  assert.deepEqual(updates, []);
});
