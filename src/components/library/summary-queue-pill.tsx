"use client";

import { type MutableRefObject, useEffect, useRef, useState } from "react";
import { resolveSummaryQueuePillPresentation, type SummaryQueuePillFeedback } from "@/lib/documents/summary-queue-pill";
import type { ApiError, ApiSuccess } from "@/server/api/response";
import type {
  SummaryQueueStatusResponseData,
  SweepDocumentAiSummaryJobsResponseData,
} from "@/server/modules/documents/document.types";
import { cx } from "@/utils/cx";

type SummaryQueueStatusApiResponse = ApiSuccess<SummaryQueueStatusResponseData> | ApiError;
type SummaryQueueSweepApiResponse = ApiSuccess<SweepDocumentAiSummaryJobsResponseData> | ApiError;

const FEEDBACK_RESET_MS = 2_400;

const toneClassName = {
  idle: "border-[color:var(--border-subtle)] bg-[color:var(--bg-surface-soft)] text-[color:var(--text-secondary)] hover:border-[color:var(--border-strong)] hover:text-[color:var(--text-primary)]",
  active:
    "border-[color:var(--border-strong)] bg-[color:var(--bg-surface-strong)] text-[color:var(--text-primary)] shadow-[var(--shadow-surface-muted)]",
  success:
    "border-[color:var(--border-strong)] bg-[color:var(--bg-surface-strong)] text-[color:var(--text-primary)] shadow-[var(--shadow-surface-muted)]",
  warning:
    "border-[color:var(--border-strong)] bg-[color:var(--bg-surface)] text-[color:var(--text-primary)] shadow-[var(--shadow-surface-muted)]",
  disabled: "border-[color:var(--border-subtle)] bg-[color:var(--bg-surface-soft)] text-[color:var(--text-tertiary)]",
} as const;

export function SummaryQueuePill({ initialStatus }: { initialStatus: SummaryQueueStatusResponseData }) {
  const [status, setStatus] = useState(initialStatus);
  const [feedback, setFeedback] = useState<SummaryQueuePillFeedback | null>(null);
  const [isSweeping, setIsSweeping] = useState(false);
  const [countdownMs, setCountdownMs] = useState(initialStatus.throttle?.retryAfterMs ?? 0);
  const isActiveRef = useRef(true);
  const feedbackTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      isActiveRef.current = false;
      if (feedbackTimeoutRef.current) {
        window.clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!status.throttle) {
      setCountdownMs(0);
      return;
    }

    let remainingMs = status.throttle.retryAfterMs;
    setCountdownMs(remainingMs);

    const intervalId = window.setInterval(() => {
      remainingMs = Math.max(remainingMs - 1_000, 0);
      if (!isActiveRef.current) {
        return;
      }

      setCountdownMs(remainingMs);

      if (remainingMs > 0) {
        return;
      }

      window.clearInterval(intervalId);
      void refreshSummaryQueueStatus(setStatus, setFeedback);
    }, 1_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [status.throttle?.cooldownUntil, status.throttle?.retryAfterMs]);

  async function handleSweep() {
    if (isSweeping) {
      return;
    }

    clearTransientFeedback(feedbackTimeoutRef, setFeedback);
    setIsSweeping(true);

    try {
      const sweep = await runSummaryQueueSweep();
      if (!isActiveRef.current) {
        return;
      }

      if (!sweep) {
        setTransientFeedback(feedbackTimeoutRef, setFeedback, { kind: "error" });
        return;
      }

      const nextStatus = await fetchSummaryQueueStatus();
      if (nextStatus && isActiveRef.current) {
        setStatus(nextStatus);
      }

      if (sweep.throttle) {
        setFeedback(null);
        return;
      }

      setTransientFeedback(feedbackTimeoutRef, setFeedback, {
        kind: "success",
        generated: sweep.generated,
        processed: sweep.processed,
      });
    } catch {
      if (!isActiveRef.current) {
        return;
      }

      setTransientFeedback(feedbackTimeoutRef, setFeedback, { kind: "error" });
    } finally {
      if (isActiveRef.current) {
        setIsSweeping(false);
      }
    }
  }

  const presentation = resolveSummaryQueuePillPresentation({
    pendingCount: status.pendingCount,
    isAvailable: status.isAvailable,
    isSweeping,
    throttle:
      status.throttle && countdownMs > 0
        ? {
            ...status.throttle,
            retryAfterMs: countdownMs,
          }
        : status.throttle,
    feedback,
  });

  return (
    <button
      className={cx(
        "inline-flex min-h-9 items-center rounded-full border px-3.5 text-sm transition",
        toneClassName[presentation.tone],
        presentation.disabled ? "cursor-not-allowed" : "cursor-pointer",
      )}
      disabled={presentation.disabled}
      onClick={() => {
        void handleSweep();
      }}
      type="button"
    >
      <span className="inline-flex items-center gap-2">
        {presentation.tone === "active" ? (
          <span aria-hidden="true" className="h-1.5 w-1.5 animate-pulse rounded-full bg-current opacity-80" />
        ) : null}
        {presentation.label}
      </span>
    </button>
  );
}

async function refreshSummaryQueueStatus(
  setStatus: (status: SummaryQueueStatusResponseData) => void,
  setFeedback: (feedback: SummaryQueuePillFeedback | null) => void,
) {
  const nextStatus = await fetchSummaryQueueStatus();
  if (!nextStatus) {
    return;
  }

  setFeedback(null);
  setStatus(nextStatus);
}

async function fetchSummaryQueueStatus() {
  const response = await fetch("/api/summary-jobs/status", {
    cache: "no-store",
  });
  const payload = (await response.json()) as SummaryQueueStatusApiResponse;

  if (!response.ok || !payload.ok) {
    return null;
  }

  return payload.data;
}

async function runSummaryQueueSweep() {
  const response = await fetch("/api/summary-jobs/sweep", {
    method: "POST",
  });
  const payload = (await response.json()) as SummaryQueueSweepApiResponse;

  if (!response.ok || !payload.ok) {
    return null;
  }

  return payload.data;
}

function clearTransientFeedback(
  feedbackTimeoutRef: MutableRefObject<number | null>,
  setFeedback: (feedback: SummaryQueuePillFeedback | null) => void,
) {
  if (feedbackTimeoutRef.current) {
    window.clearTimeout(feedbackTimeoutRef.current);
    feedbackTimeoutRef.current = null;
  }

  setFeedback(null);
}

function setTransientFeedback(
  feedbackTimeoutRef: MutableRefObject<number | null>,
  setFeedback: (feedback: SummaryQueuePillFeedback | null) => void,
  feedback: SummaryQueuePillFeedback,
) {
  clearTransientFeedback(feedbackTimeoutRef, setFeedback);
  setFeedback(feedback);
  feedbackTimeoutRef.current = window.setTimeout(() => {
    setFeedback(null);
    feedbackTimeoutRef.current = null;
  }, FEEDBACK_RESET_MS);
}
