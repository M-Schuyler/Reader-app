"use client";

import { useEffect, useRef } from "react";
import { ReadState } from "@prisma/client";

type UseDocumentReadingProgressOptions = {
  documentId: string;
  initialProgress: number;
  readState: ReadState;
};

export function useDocumentReadingProgress({
  documentId,
  initialProgress,
  readState,
}: UseDocumentReadingProgressOptions) {
  const lastSavedProgressRef = useRef(initialProgress);
  const currentProgressRef = useRef(initialProgress);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (readState === ReadState.READ) {
      return;
    }

    const saveProgress = async (progress: number) => {
      try {
        await fetch(`/api/documents/${documentId}/progress`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ progress }),
        });
        lastSavedProgressRef.current = progress;
      } catch (error) {
        console.error("Failed to save reading progress:", error);
      }
    };

    const handleScroll = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollHeight <= 0) return;

      const progress = Math.min(100, Math.max(0, (window.scrollY / scrollHeight) * 100));
      currentProgressRef.current = progress;

      // Debounce and only save if progress increased by more than 5% or reached 90%+
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }

      timerRef.current = window.setTimeout(() => {
        const diff = progress - lastSavedProgressRef.current;
        if (diff > 5 || (progress > 90 && diff > 1)) {
          void saveProgress(Math.round(progress));
        }
      }, 2000);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, [documentId, readState]);
}
