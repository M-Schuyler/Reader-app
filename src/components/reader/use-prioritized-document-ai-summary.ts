"use client";

import { useEffect, useRef, useState } from "react";
import {
  resolveDocumentAiSummaryPriorityRetryDelay,
  shouldAutoPrioritizeDocumentAiSummary,
} from "@/lib/documents/document-ai-summary-priority";
import type { ApiError, ApiSuccess } from "@/server/api/response";
import type {
  DocumentDetail,
  PrioritizeDocumentAiSummaryResponseData,
} from "@/server/modules/documents/document.types";

type PrioritizeDocumentAiSummaryApiResponse = ApiSuccess<PrioritizeDocumentAiSummaryResponseData> | ApiError;

export function usePrioritizedDocumentAiSummary(initialDocument: DocumentDetail) {
  const [document, setDocument] = useState(initialDocument);
  const retryTimeoutRef = useRef<number | null>(null);
  const pendingRequestRef = useRef(false);

  useEffect(() => {
    setDocument(initialDocument);
  }, [initialDocument]);

  useEffect(() => {
    let isActive = true;

    clearRetryTimeout(retryTimeoutRef.current);
    retryTimeoutRef.current = null;
    pendingRequestRef.current = false;

    if (!shouldAutoPrioritizeDocumentAiSummary(initialDocument)) {
      return () => {
        isActive = false;
        clearRetryTimeout(retryTimeoutRef.current);
      };
    }

    const requestSummary = async () => {
      if (!isActive || pendingRequestRef.current) {
        return;
      }

      pendingRequestRef.current = true;

      try {
        const response = await fetch(`/api/documents/${initialDocument.id}/summary`, {
          method: "POST",
        });
        const payload = (await response.json()) as PrioritizeDocumentAiSummaryApiResponse;

        if (!payload.ok || !isActive) {
          return;
        }

        setDocument(payload.data.document);

        const retryDelay = resolveDocumentAiSummaryPriorityRetryDelay(payload.data.summary);
        if (retryDelay !== null && shouldAutoPrioritizeDocumentAiSummary(payload.data.document)) {
          retryTimeoutRef.current = window.setTimeout(() => {
            retryTimeoutRef.current = null;
            void requestSummary();
          }, retryDelay);
        }
      } catch {
        // Keep the reader calm; the next open or refresh can retry.
      } finally {
        pendingRequestRef.current = false;
      }
    };

    void requestSummary();

    return () => {
      isActive = false;
      clearRetryTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
      pendingRequestRef.current = false;
    };
  }, [initialDocument]);

  return document;
}

function clearRetryTimeout(timeoutId: number | null) {
  if (timeoutId !== null) {
    window.clearTimeout(timeoutId);
  }
}
