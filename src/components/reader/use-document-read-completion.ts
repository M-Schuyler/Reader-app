"use client";

import { useRouter } from "next/navigation";
import { ReadState } from "@prisma/client";
import { useEffect, useRef, useState, useTransition } from "react";

const COMPLETION_NEAR_BOTTOM_OFFSET_PX = 400;
const COMPLETION_EXTRA_PULL_THRESHOLD_PX = 120;
const COMPLETION_MIN_SCROLLABLE_HEIGHT_PX = 240;
const COMPLETION_SHORT_DOC_BOTTOM_TOLERANCE_PX = 2;
const COMPLETION_ANIMATION_TOTAL_MS = 1600;
const COMPLETION_RETRY_DELAY_MS = 1200;
const COMPLETION_REFRESH_DELAY_MS = 1750;

export type DocumentReadCompletionPhase = "idle" | "armed" | "animating" | "saving" | "completed";

export type DocumentReadCompletionGeometry = {
  isEnabled: boolean;
  isTriggered: boolean;
  readState: ReadState;
  scrollY: number;
  scrollableHeight: number;
  sentinelTop: number;
  viewportBottom: number;
};

type UseDocumentReadCompletionOptions = {
  documentId: string;
  isEnabled: boolean;
  readState: ReadState;
};

export function useDocumentReadCompletion(options: UseDocumentReadCompletionOptions) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const sentinelRef = useRef<HTMLDivElement>(null);
  const persistTimeoutRef = useRef<number | null>(null);
  const refreshTimeoutRef = useRef<number | null>(null);
  const retryTimeoutRef = useRef<number | null>(null);
  const hasTriggeredRef = useRef(false);
  const isPersistingRef = useRef(false);
  const [phase, setPhase] = useState<DocumentReadCompletionPhase>("idle");

  useEffect(() => {
    clearWindowTimeout(persistTimeoutRef.current);
    clearWindowTimeout(refreshTimeoutRef.current);
    clearWindowTimeout(retryTimeoutRef.current);
    persistTimeoutRef.current = null;
    refreshTimeoutRef.current = null;
    retryTimeoutRef.current = null;
    hasTriggeredRef.current = false;
    isPersistingRef.current = false;
    setPhase("idle");

    if (!options.isEnabled || options.readState === ReadState.READ) {
      return;
    }

    const persistReadState = async () => {
      if (isPersistingRef.current) {
        return;
      }

      isPersistingRef.current = true;
      setPhase("saving");

      try {
        await sendReadCompletionRequest(options.documentId);
        setPhase("completed");
        scheduleRefreshAfterCompletion(refreshTimeoutRef, startTransition, () => {
          router.refresh();
        });
      } catch {
        isPersistingRef.current = false;
        retryTimeoutRef.current = window.setTimeout(async () => {
          retryTimeoutRef.current = null;
          isPersistingRef.current = true;

          try {
            await sendReadCompletionRequest(options.documentId);
            setPhase("completed");
            scheduleRefreshAfterCompletion(refreshTimeoutRef, startTransition, () => {
              router.refresh();
            });
          } catch {
            setPhase("completed");
          } finally {
            isPersistingRef.current = false;
          }
        }, COMPLETION_RETRY_DELAY_MS);
        return;
      }

      isPersistingRef.current = false;
    };

    const handleScroll = () => {
      const geometry = measureDocumentReadCompletionGeometry({
        isEnabled: options.isEnabled,
        isTriggered: hasTriggeredRef.current,
        readState: options.readState,
        sentinelElement: sentinelRef.current,
      });

      if (!geometry) {
        return;
      }

      if (!hasTriggeredRef.current && shouldTriggerDocumentReadCompletion(geometry)) {
        hasTriggeredRef.current = true;
        setPhase("animating");
        persistTimeoutRef.current = window.setTimeout(() => {
          persistTimeoutRef.current = null;
          const latestGeometry = measureDocumentReadCompletionGeometry({
            isEnabled: options.isEnabled,
            isTriggered: false,
            readState: options.readState,
            sentinelElement: sentinelRef.current,
          });

          if (!latestGeometry || !shouldTriggerDocumentReadCompletion(latestGeometry)) {
            hasTriggeredRef.current = false;
            setPhase(latestGeometry ? resolveDocumentReadCompletionPhase("idle", latestGeometry) : "idle");
            return;
          }

          void persistReadState();
        }, COMPLETION_ANIMATION_TOTAL_MS);
        return;
      }

      setPhase((currentPhase) => resolveDocumentReadCompletionPhase(currentPhase, geometry));
    };

    handleScroll();
    window.addEventListener("resize", handleScroll);
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("resize", handleScroll);
      window.removeEventListener("scroll", handleScroll);
      clearWindowTimeout(persistTimeoutRef.current);
      clearWindowTimeout(refreshTimeoutRef.current);
      clearWindowTimeout(retryTimeoutRef.current);
      persistTimeoutRef.current = null;
      refreshTimeoutRef.current = null;
      retryTimeoutRef.current = null;
      hasTriggeredRef.current = false;
      isPersistingRef.current = false;
    };
  }, [options.documentId, options.isEnabled, options.readState, router, startTransition]);

  return {
    phase,
    sentinelRef,
    isVisible: options.isEnabled && (options.readState !== ReadState.READ || phase === "completed" || phase === "animating" || phase === "saving"),
  };
}

export function shouldTriggerDocumentReadCompletion(geometry: DocumentReadCompletionGeometry) {
  if (!shouldArmDocumentReadCompletion(geometry)) {
    return false;
  }

  return geometry.viewportBottom - geometry.sentinelTop >= COMPLETION_EXTRA_PULL_THRESHOLD_PX;
}

export function resolveDocumentReadCompletionPhase(
  currentPhase: DocumentReadCompletionPhase,
  geometry: DocumentReadCompletionGeometry,
): DocumentReadCompletionPhase {
  if (currentPhase === "animating" || currentPhase === "saving" || currentPhase === "completed") {
    return currentPhase;
  }

  if (shouldTriggerDocumentReadCompletion(geometry)) {
    return "animating";
  }

  return shouldArmDocumentReadCompletion(geometry) ? "armed" : "idle";
}

function shouldArmDocumentReadCompletion(geometry: DocumentReadCompletionGeometry) {
  if (!geometry.isEnabled || geometry.isTriggered || geometry.readState === ReadState.READ) {
    return false;
  }

  if (isShortScrollableDocument(geometry)) {
    return geometry.scrollY > 0 && isNearDocumentBottom(geometry);
  }

  return geometry.sentinelTop <= geometry.viewportBottom + COMPLETION_NEAR_BOTTOM_OFFSET_PX;
}

function measureDocumentReadCompletionGeometry(options: {
  isEnabled: boolean;
  isTriggered: boolean;
  readState: ReadState;
  sentinelElement: HTMLDivElement | null;
}): DocumentReadCompletionGeometry | null {
  if (!options.sentinelElement || typeof window === "undefined") {
    return null;
  }

  const rect = options.sentinelElement.getBoundingClientRect();

  return {
    isEnabled: options.isEnabled,
    isTriggered: options.isTriggered,
    readState: options.readState,
    scrollY: window.scrollY,
    scrollableHeight: Math.max(0, document.documentElement.scrollHeight - window.innerHeight),
    sentinelTop: rect.top + window.scrollY,
    viewportBottom: window.scrollY + window.innerHeight,
  };
}

function isShortScrollableDocument(geometry: DocumentReadCompletionGeometry) {
  return geometry.scrollableHeight <= COMPLETION_MIN_SCROLLABLE_HEIGHT_PX;
}

function isNearDocumentBottom(geometry: DocumentReadCompletionGeometry) {
  return geometry.scrollableHeight - geometry.scrollY <= COMPLETION_SHORT_DOC_BOTTOM_TOLERANCE_PX;
}

async function sendReadCompletionRequest(documentId: string) {
  const response = await fetch(`/api/documents/${documentId}/read-state`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      readState: ReadState.READ,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to mark document as read.");
  }
}

function clearWindowTimeout(timeoutId: number | null) {
  if (timeoutId !== null && typeof window !== "undefined") {
    window.clearTimeout(timeoutId);
  }
}

function scheduleRefreshAfterCompletion(
  timeoutRef: { current: number | null },
  startTransition: (callback: () => void) => void,
  refresh: () => void,
) {
  clearWindowTimeout(timeoutRef.current);
  timeoutRef.current = window.setTimeout(() => {
    timeoutRef.current = null;
    startTransition(() => {
      refresh();
    });
  }, COMPLETION_REFRESH_DELAY_MS);
}
