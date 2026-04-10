import assert from "node:assert/strict";
import test from "node:test";
import { upsertWechatSubsource } from "./wechat-subsource.service";

test("creates a placeholder subsource when no display name is provided", async () => {
  const createCalls: Array<{ biz: string; displayName: string; isPlaceholder: boolean }> = [];

  const record = await upsertWechatSubsource(
    {
      biz: "MzI0MDg5ODA2NQ==",
      displayName: null,
    },
    {
      findWechatSubsourceByBiz: async () => null,
      createWechatSubsource: async (input) => {
        createCalls.push(input);
        return {
          ...input,
          createdAt: new Date("2026-04-10T00:00:00.000Z"),
          updatedAt: new Date("2026-04-10T00:00:00.000Z"),
        };
      },
      updateWechatSubsource: async () => {
        throw new Error("placeholder writes should not update an existing row");
      },
    },
  );

  assert.deepEqual(createCalls, [
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
  const createCalls: Array<{ biz: string; displayName: string; isPlaceholder: boolean }> = [];
  const updateCalls: Array<{ biz: string; displayName: string; isPlaceholder: boolean }> = [];

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
      createWechatSubsource: async (input) => {
        createCalls.push(input);
        return {
          ...input,
          createdAt: new Date("2026-04-10T00:00:00.000Z"),
          updatedAt: new Date("2026-04-10T00:00:00.000Z"),
        };
      },
      updateWechatSubsource: async (biz, input) => {
        updateCalls.push({ biz, ...input });
        return {
          biz,
          ...input,
          createdAt: new Date("2026-04-10T00:00:00.000Z"),
          updatedAt: new Date("2026-04-10T00:00:00.000Z"),
        };
      },
    },
  );

  assert.deepEqual(createCalls, []);
  assert.deepEqual(updateCalls, [
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
  const createCalls: Array<{ biz: string; displayName: string; isPlaceholder: boolean }> = [];
  const updateCalls: Array<{ biz: string; displayName: string; isPlaceholder: boolean }> = [];
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
      createWechatSubsource: async (input) => {
        createCalls.push(input);
        return {
          ...input,
          createdAt: existing.createdAt,
          updatedAt: existing.updatedAt,
        };
      },
      updateWechatSubsource: async (biz, input) => {
        updateCalls.push({ biz, ...input });
        return {
          biz,
          ...input,
          createdAt: existing.createdAt,
          updatedAt: existing.updatedAt,
        };
      },
    },
  );

  assert.deepEqual(createCalls, []);
  assert.deepEqual(updateCalls, []);
  assert.equal(record.displayName, "请辩");
  assert.equal(record.isPlaceholder, false);
});

test("creates and re-reads instead of overwriting when a placeholder write races with a real name", async () => {
  const createCalls: Array<{ biz: string; displayName: string; isPlaceholder: boolean }> = [];
  const updateCalls: Array<{ biz: string; displayName: string; isPlaceholder: boolean }> = [];
  const existing = {
    biz: "MzI0MDg5ODA2NQ==",
    displayName: "请辩",
    isPlaceholder: false,
    createdAt: new Date("2026-04-10T00:00:00.000Z"),
    updatedAt: new Date("2026-04-10T00:00:00.000Z"),
  };
  let findCount = 0;

  const record = await upsertWechatSubsource(
    {
      biz: "MzI0MDg5ODA2NQ==",
      displayName: null,
    },
    {
      findWechatSubsourceByBiz: async () => {
        findCount += 1;
        return findCount === 1 ? null : existing;
      },
      createWechatSubsource: async (input) => {
        createCalls.push(input);
        throw makeUniqueConstraintError();
      },
      updateWechatSubsource: async (biz, input) => {
        updateCalls.push({ biz, ...input });
        return {
          biz,
          ...input,
          createdAt: existing.createdAt,
          updatedAt: existing.updatedAt,
        };
      },
    },
  );

  assert.deepEqual(createCalls, [
    {
      biz: "MzI0MDg5ODA2NQ==",
      displayName: "未命名公众号 MzI0MD…",
      isPlaceholder: true,
    },
  ]);
  assert.deepEqual(updateCalls, []);
  assert.equal(record.displayName, "请辩");
  assert.equal(record.isPlaceholder, false);
});

test("updates an existing non-placeholder record when a real display name changes", async () => {
  const createCalls: Array<{ biz: string; displayName: string; isPlaceholder: boolean }> = [];
  const updateCalls: Array<{ biz: string; displayName: string; isPlaceholder: boolean }> = [];

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
      createWechatSubsource: async (input) => {
        createCalls.push(input);
        return {
          ...input,
          createdAt: new Date("2026-04-10T00:00:00.000Z"),
          updatedAt: new Date("2026-04-10T00:00:00.000Z"),
        };
      },
      updateWechatSubsource: async (biz, input) => {
        updateCalls.push({ biz, ...input });
        return {
          biz,
          ...input,
          createdAt: new Date("2026-04-10T00:00:00.000Z"),
          updatedAt: new Date("2026-04-10T00:00:00.000Z"),
        };
      },
    },
  );

  assert.deepEqual(createCalls, []);
  assert.deepEqual(updateCalls, [
    {
      biz: "MzI0MDg5ODA2NQ==",
      displayName: "请辩的新名字",
      isPlaceholder: false,
    },
  ]);
  assert.equal(record.displayName, "请辩的新名字");
  assert.equal(record.isPlaceholder, false);
});

function makeUniqueConstraintError() {
  return { code: "P2002" };
}
