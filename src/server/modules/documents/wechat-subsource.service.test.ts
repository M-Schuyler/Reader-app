import assert from "node:assert/strict";
import test from "node:test";
import { upsertWechatSubsource } from "./wechat-subsource.service";

test("creates a placeholder subsource when no display name is provided", async () => {
  const calls: Array<{ biz: string; displayName: string; isPlaceholder: boolean }> = [];

  const record = await upsertWechatSubsource(
    {
      biz: "MzI0MDg5ODA2NQ==",
      displayName: null,
    },
    {
      findWechatSubsourceByBiz: async () => null,
      upsertWechatSubsourceRecord: async (input) => {
        calls.push(input);
        return {
          ...input,
          createdAt: new Date("2026-04-10T00:00:00.000Z"),
          updatedAt: new Date("2026-04-10T00:00:00.000Z"),
        };
      },
    },
  );

  assert.deepEqual(calls, [
    {
      biz: "MzI0MDg5ODA2NQ==",
      displayName: "未命名公众号 MzI0MD…",
      isPlaceholder: true,
    },
  ]);
  assert.equal(record.displayName, "未命名公众号 MzI0MD…");
  assert.equal(record.isPlaceholder, true);
});

test("promotes an existing placeholder to a real display name", async () => {
  const calls: Array<{ biz: string; displayName: string; isPlaceholder: boolean }> = [];

  const record = await upsertWechatSubsource(
    {
      biz: "MzI0MDg5ODA2NQ==",
      displayName: "  请辩  ",
    },
    {
      findWechatSubsourceByBiz: async () => ({
        biz: "MzI0MDg5ODA2NQ==",
        displayName: "未命名公众号 MzI0MD…",
        isPlaceholder: true,
        createdAt: new Date("2026-04-10T00:00:00.000Z"),
        updatedAt: new Date("2026-04-10T00:00:00.000Z"),
      }),
      upsertWechatSubsourceRecord: async (input) => {
        calls.push(input);
        return {
          ...input,
          createdAt: new Date("2026-04-10T00:00:00.000Z"),
          updatedAt: new Date("2026-04-10T00:00:00.000Z"),
        };
      },
    },
  );

  assert.deepEqual(calls, [
    {
      biz: "MzI0MDg5ODA2NQ==",
      displayName: "请辩",
      isPlaceholder: false,
    },
  ]);
  assert.equal(record.displayName, "请辩");
  assert.equal(record.isPlaceholder, false);
});

test("does not overwrite an existing real display name with a later placeholder write", async () => {
  const calls: Array<{ biz: string; displayName: string; isPlaceholder: boolean }> = [];
  const existing = {
    biz: "MzI0MDg5ODA2NQ==",
    displayName: "请辩",
    isPlaceholder: false,
    createdAt: new Date("2026-04-10T00:00:00.000Z"),
    updatedAt: new Date("2026-04-10T00:00:00.000Z"),
  };

  const record = await upsertWechatSubsource(
    {
      biz: "MzI0MDg5ODA2NQ==",
      displayName: undefined,
    },
    {
      findWechatSubsourceByBiz: async () => existing,
      upsertWechatSubsourceRecord: async (input) => {
        calls.push(input);
        return {
          ...input,
          createdAt: existing.createdAt,
          updatedAt: existing.updatedAt,
        };
      },
    },
  );

  assert.deepEqual(calls, []);
  assert.equal(record.displayName, "请辩");
  assert.equal(record.isPlaceholder, false);
});

test("updates an existing non-placeholder record when a real display name changes", async () => {
  const calls: Array<{ biz: string; displayName: string; isPlaceholder: boolean }> = [];

  const record = await upsertWechatSubsource(
    {
      biz: "MzI0MDg5ODA2NQ==",
      displayName: "请辩的新名字",
    },
    {
      findWechatSubsourceByBiz: async () => ({
        biz: "MzI0MDg5ODA2NQ==",
        displayName: "请辩",
        isPlaceholder: false,
        createdAt: new Date("2026-04-10T00:00:00.000Z"),
        updatedAt: new Date("2026-04-10T00:00:00.000Z"),
      }),
      upsertWechatSubsourceRecord: async (input) => {
        calls.push(input);
        return {
          ...input,
          createdAt: new Date("2026-04-10T00:00:00.000Z"),
          updatedAt: new Date("2026-04-10T00:00:00.000Z"),
        };
      },
    },
  );

  assert.deepEqual(calls, [
    {
      biz: "MzI0MDg5ODA2NQ==",
      displayName: "请辩的新名字",
      isPlaceholder: false,
    },
  ]);
  assert.equal(record.displayName, "请辩的新名字");
  assert.equal(record.isPlaceholder, false);
});
