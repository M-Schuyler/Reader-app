import assert from "node:assert/strict";
import test from "node:test";
import { prisma } from "@/server/db/client";
import {
  applyAiSummaryRunnerCooldown,
  clearAiSummaryRunnerCooldown,
  getAiSummaryRunnerState,
  withAiSummaryProviderLock,
} from "@/server/modules/documents/document-ai-summary-jobs.service";

const TEST_PROVIDERS = ["gemini", "openai"] as const;

test.beforeEach(async () => {
  await prisma.aiSummaryRunnerState.deleteMany({
    where: {
      provider: {
        in: [...TEST_PROVIDERS],
      },
    },
  });
});

test.after(async () => {
  await prisma.aiSummaryRunnerState.deleteMany({
    where: {
      provider: {
        in: [...TEST_PROVIDERS],
      },
    },
  });
});

test("same provider lock only allows one concurrent runner", { concurrency: false }, async () => {
  const entered = createDeferred<void>();
  const release = createDeferred<void>();

  const first = withAiSummaryProviderLock("gemini", async () => {
    entered.resolve();
    await release.promise;
    return "first";
  });

  await entered.promise;

  const second = await withAiSummaryProviderLock("gemini", async () => "second");
  release.resolve();

  const firstResult = await first;

  assert.deepEqual(firstResult, {
    status: "acquired",
    value: "first",
  });
  assert.deepEqual(second, {
    status: "runner_busy",
  });
});

test("different provider locks do not block each other", { concurrency: false }, async () => {
  const entered = createDeferred<void>();
  const release = createDeferred<void>();

  const first = withAiSummaryProviderLock("gemini", async () => {
    entered.resolve();
    await release.promise;
    return "gemini";
  });

  await entered.promise;

  const second = await withAiSummaryProviderLock("openai", async () => "openai");
  release.resolve();
  const firstResult = await first;

  assert.deepEqual(firstResult, {
    status: "acquired",
    value: "gemini",
  });
  assert.deepEqual(second, {
    status: "acquired",
    value: "openai",
  });
});

test("shared cooldown written by one runner is visible to the next runner", { concurrency: false }, async () => {
  const cooldown = await withAiSummaryProviderLock("gemini", async (tx) => {
    return applyAiSummaryRunnerCooldown(tx, "gemini", undefined, 1_000, {
      random: () => 0,
    });
  });

  const state = await withAiSummaryProviderLock("gemini", async (tx) => {
    return getAiSummaryRunnerState(tx, "gemini");
  });

  assert.deepEqual(cooldown, {
    status: "acquired",
    value: {
      reason: "rate_limited",
      retryAfterMs: 15_000,
      cooldownUntil: new Date(16_000).toISOString(),
    },
  });

  assert.equal(state.status, "acquired");
  assert.equal(state.value.cooldownUntil?.toISOString(), new Date(16_000).toISOString());
  assert.equal(state.value.lastCooldownMs, 15_000);
  assert.equal(state.value.consecutiveRateLimitCount, 1);
});

test("missing runner state row reads back as no cooldown", { concurrency: false }, async () => {
  const result = await withAiSummaryProviderLock("openai", async (tx) => {
    await clearAiSummaryRunnerCooldown(tx, "openai");
    return getAiSummaryRunnerState(tx, "openai");
  });

  assert.deepEqual(result, {
    status: "acquired",
    value: {
      cooldownUntil: null,
      lastCooldownMs: 0,
      consecutiveRateLimitCount: 0,
    },
  });
});

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve;
    reject = innerReject;
  });

  return {
    promise,
    resolve,
    reject,
  };
}
