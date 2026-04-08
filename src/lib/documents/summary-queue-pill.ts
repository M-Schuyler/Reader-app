import type { SummaryRunnerThrottle } from "@/server/modules/documents/document.types";

export type SummaryQueuePillFeedback =
  | {
      kind: "success";
      generated: number;
      processed: number;
    }
  | {
      kind: "error";
    };

export type SummaryQueuePillPresentation = {
  label: string;
  disabled: boolean;
  tone: "idle" | "active" | "success" | "warning" | "disabled";
};

type SummaryQueuePillPresentationInput = {
  pendingCount: number;
  isAvailable: boolean;
  isSweeping: boolean;
  throttle: SummaryRunnerThrottle | null;
  feedback: SummaryQueuePillFeedback | null;
};

export function resolveSummaryQueuePillPresentation(
  input: SummaryQueuePillPresentationInput,
): SummaryQueuePillPresentation {
  if (!input.isAvailable) {
    return {
      label: "摘要暂不可用",
      disabled: true,
      tone: "disabled",
    };
  }

  if (input.isSweeping) {
    return {
      label: "处理中…",
      disabled: true,
      tone: "active",
    };
  }

  if (input.throttle) {
    return {
      label: `稍后再试 ${Math.max(1, Math.ceil(input.throttle.retryAfterMs / 1_000))}s`,
      disabled: true,
      tone: "warning",
    };
  }

  if (input.feedback?.kind === "success") {
    return {
      label:
        input.feedback.generated > 0
          ? `已补跑 ${input.feedback.generated} 篇`
          : input.feedback.processed > 0
            ? `已检查 ${input.feedback.processed} 篇`
            : "摘要已是最新",
      disabled: false,
      tone: "success",
    };
  }

  if (input.feedback?.kind === "error") {
    return {
      label: "稍后重试",
      disabled: false,
      tone: "warning",
    };
  }

  if (input.pendingCount <= 0) {
    return {
      label: "摘要已是最新",
      disabled: false,
      tone: "idle",
    };
  }

  return {
    label: `摘要队列 ${input.pendingCount}`,
    disabled: false,
    tone: "idle",
  };
}
