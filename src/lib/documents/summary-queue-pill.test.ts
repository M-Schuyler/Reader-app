import assert from "node:assert/strict";
import test from "node:test";
import { resolveSummaryQueuePillPresentation } from "@/lib/documents/summary-queue-pill";

test("summary queue pill shows the live queue count while idle", () => {
  assert.deepEqual(
    resolveSummaryQueuePillPresentation({
      pendingCount: 307,
      isAvailable: true,
      isSweeping: false,
      throttle: null,
      feedback: null,
    }),
    {
      disabled: false,
      label: "摘要队列 307",
      tone: "idle",
    },
  );
});

test("summary queue pill switches to a processing state while a sweep is running", () => {
  assert.deepEqual(
    resolveSummaryQueuePillPresentation({
      pendingCount: 307,
      isAvailable: true,
      isSweeping: true,
      throttle: null,
      feedback: null,
    }),
    {
      disabled: true,
      label: "处理中…",
      tone: "active",
    },
  );
});

test("summary queue pill shows cooldown feedback when the runner is rate-limited", () => {
  assert.deepEqual(
    resolveSummaryQueuePillPresentation({
      pendingCount: 307,
      isAvailable: true,
      isSweeping: false,
      throttle: {
        reason: "rate_limited",
        retryAfterMs: 30_400,
        cooldownUntil: new Date(31_000).toISOString(),
      },
      feedback: null,
    }),
    {
      disabled: true,
      label: "稍后再试 31s",
      tone: "warning",
    },
  );
});

test("summary queue pill shows a short-lived success label after generating summaries", () => {
  assert.deepEqual(
    resolveSummaryQueuePillPresentation({
      pendingCount: 305,
      isAvailable: true,
      isSweeping: false,
      throttle: null,
      feedback: {
        kind: "success",
        generated: 2,
        processed: 3,
      },
    }),
    {
      disabled: false,
      label: "已补跑 2 篇",
      tone: "success",
    },
  );
});

test("summary queue pill falls back to an up-to-date label when the queue is empty", () => {
  assert.deepEqual(
    resolveSummaryQueuePillPresentation({
      pendingCount: 0,
      isAvailable: true,
      isSweeping: false,
      throttle: null,
      feedback: null,
    }),
    {
      disabled: false,
      label: "摘要已是最新",
      tone: "idle",
    },
  );
});

test("summary queue pill disables itself when the runtime is unavailable", () => {
  assert.deepEqual(
    resolveSummaryQueuePillPresentation({
      pendingCount: 12,
      isAvailable: false,
      isSweeping: false,
      throttle: null,
      feedback: null,
    }),
    {
      disabled: true,
      label: "摘要暂不可用",
      tone: "disabled",
    },
  );
});
