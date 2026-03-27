"use client";

import { IngestionStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ApiError, ApiSuccess } from "@/server/api/response";
import { cx } from "@/utils/cx";
import type {
  DocumentDetail,
  DocumentListItem,
  UpdateDocumentFavoriteResponseData,
} from "@/server/modules/documents/document.types";

export type FavoriteSummaryUiState = "not_favorite" | "generating" | "ready" | "failed";

type FavoriteDocument = Pick<
  DocumentListItem,
  "id" | "isFavorite" | "aiSummary" | "aiSummaryStatus" | "aiSummaryError" | "excerpt" | "ingestionStatus"
> |
  Pick<
    DocumentDetail,
    "id" | "isFavorite" | "aiSummary" | "aiSummaryStatus" | "aiSummaryError" | "excerpt" | "ingestionStatus"
  >;

type FavoriteControllerState = {
  isFavorite: boolean;
  aiSummary: string | null;
  summaryState: FavoriteSummaryUiState;
  summaryError: string | null;
};

type PersistedFailureState = {
  errorMessage: string | null;
};

type UpdateFavoriteApiResponse = ApiSuccess<UpdateDocumentFavoriteResponseData> | ApiError;

const STORAGE_PREFIX = "reader:favorite-summary";

export function useDocumentFavoriteController(document: FavoriteDocument) {
  const router = useRouter();
  const [state, setState] = useState<FavoriteControllerState>(() => deriveStateFromDocument(document));
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<"favorite" | "unfavorite" | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (pendingAction) {
      return;
    }

    const nextState = deriveStateFromDocument(document, readPersistedFailureState(document.id));
    setState(nextState);
    syncPersistedFailureState(document.id, nextState);
  }, [document.aiSummary, document.aiSummaryError, document.aiSummaryStatus, document.id, document.ingestionStatus, document.isFavorite, pendingAction]);

  async function toggleFavorite() {
    if (pendingAction) {
      return;
    }

    const nextFavorite = !state.isFavorite;
    const previousState = state;
    setActionError(null);
    setPendingAction(nextFavorite ? "favorite" : "unfavorite");
    setState({
      isFavorite: nextFavorite,
      aiSummary: state.aiSummary,
      summaryState: nextFavorite ? (state.aiSummary ? "ready" : "generating") : "not_favorite",
      summaryError: null,
    });

    try {
      const response = await fetch(`/api/documents/${document.id}/favorite`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          isFavorite: nextFavorite,
        }),
      });
      const payload = (await response.json()) as UpdateFavoriteApiResponse;
      if (!payload.ok) {
        throw new Error(payload.error.message);
      }

      const nextState = deriveStateFromResponse(payload.data);
      setState(nextState);
      syncPersistedFailureState(document.id, nextState);

      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setState(previousState);
      setActionError(error instanceof Error ? error.message : "Failed to update favorite state.");
    } finally {
      setPendingAction(null);
    }
  }

  return {
    isFavorite: state.isFavorite,
    aiSummary: state.aiSummary,
    summaryState: state.summaryState,
    summaryError: state.summaryError,
    supportText: resolveDocumentSupportText(document, state),
    buttonLabel: formatFavoriteButtonLabel(state.summaryState, state.isFavorite, pendingAction),
    isSubmitting: pendingAction !== null,
    actionError,
    toggleFavorite,
  };
}

export function FavoriteToggleButton(props: {
  buttonLabel: string;
  className?: string;
  isFavorite: boolean;
  isSubmitting: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      size="sm"
      variant={props.isFavorite ? "secondary" : "quiet"}
      className={cx(props.isFavorite ? "bg-[color:var(--bg-surface-strong)] text-[color:var(--text-primary)]" : undefined, props.className)}
      disabled={props.isSubmitting}
      onClick={props.onClick}
    >
      {props.buttonLabel}
    </Button>
  );
}

export function FavoriteSummaryBadge({ state }: { state: FavoriteSummaryUiState }) {
  return <Badge tone={summaryBadgeTone(state)}>{formatSummaryState(state)}</Badge>;
}

function deriveStateFromDocument(
  document: FavoriteDocument,
  persistedFailureState: PersistedFailureState | null = null,
): FavoriteControllerState {
  if (!document.isFavorite) {
    return {
      isFavorite: false,
      aiSummary: document.aiSummary,
      summaryState: "not_favorite",
      summaryError: null,
    };
  }

  if (document.aiSummary) {
    return {
      isFavorite: true,
      aiSummary: document.aiSummary,
      summaryState: "ready",
      summaryError: null,
    };
  }

  if (shouldHideSummaryUi(document.aiSummaryError)) {
    return {
      isFavorite: true,
      aiSummary: null,
      summaryState: "not_favorite",
      summaryError: null,
    };
  }

  if (document.aiSummaryStatus === "FAILED" || document.ingestionStatus === IngestionStatus.FAILED) {
    return {
      isFavorite: true,
      aiSummary: null,
      summaryState: "failed",
      summaryError: document.aiSummaryError ?? defaultSummaryFailureMessage(document),
    };
  }

  if (persistedFailureState) {
    return {
      isFavorite: true,
      aiSummary: null,
      summaryState: "failed",
      summaryError: persistedFailureState.errorMessage ?? defaultSummaryFailureMessage(document),
    };
  }

  return {
    isFavorite: true,
    aiSummary: null,
    summaryState: "generating",
    summaryError: null,
  };
}

function deriveStateFromResponse(data: UpdateDocumentFavoriteResponseData): FavoriteControllerState {
  if (!data.document.isFavorite) {
    return {
      isFavorite: false,
      aiSummary: data.document.aiSummary,
      summaryState: "not_favorite",
      summaryError: null,
    };
  }

  if (data.document.aiSummary) {
    return {
      isFavorite: true,
      aiSummary: data.document.aiSummary,
      summaryState: "ready",
      summaryError: null,
    };
  }

  if (shouldHideSummaryUi(data.summary.error?.message, data.summary.error?.code)) {
    return {
      isFavorite: true,
      aiSummary: null,
      summaryState: "not_favorite",
      summaryError: null,
    };
  }

  if (data.summary.status === "failed") {
    return {
      isFavorite: true,
      aiSummary: null,
      summaryState: "failed",
      summaryError: data.summary.error?.message ?? defaultSummaryFailureMessage(data.document),
    };
  }

  return {
    isFavorite: true,
    aiSummary: null,
    summaryState: "generating",
    summaryError: null,
  };
}

function resolveDocumentSupportText(document: FavoriteDocument, state: FavoriteControllerState) {
  if (document.ingestionStatus === IngestionStatus.FAILED) {
    return null;
  }

  if (state.summaryState === "ready") {
    return state.aiSummary;
  }

  return document.excerpt;
}

function formatFavoriteButtonLabel(
  summaryState: FavoriteSummaryUiState,
  isFavorite: boolean,
  pendingAction: "favorite" | "unfavorite" | null,
) {
  if (pendingAction === "favorite") {
    return "Saving...";
  }

  if (pendingAction === "unfavorite") {
    return "Removing...";
  }

  return isFavorite ? "Saved" : "Save";
}

function formatSummaryState(state: FavoriteSummaryUiState) {
  switch (state) {
    case "generating":
      return "Saved, summary pending";
    case "ready":
      return "Saved, summary ready";
    case "failed":
      return "Saved, summary failed";
    case "not_favorite":
    default:
      return "Not saved";
  }
}

function summaryBadgeTone(state: FavoriteSummaryUiState) {
  switch (state) {
    case "generating":
      return "neutral";
    case "ready":
      return "success";
    case "failed":
      return "danger";
    case "not_favorite":
    default:
      return "subtle";
  }
}

function storageKey(documentId: string) {
  return `${STORAGE_PREFIX}:${documentId}`;
}

function readPersistedFailureState(documentId: string): PersistedFailureState | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.localStorage.getItem(storageKey(documentId));
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as { errorMessage?: unknown };
    return {
      errorMessage: typeof parsed.errorMessage === "string" ? parsed.errorMessage : null,
    };
  } catch {
    return null;
  }
}

function syncPersistedFailureState(documentId: string, state: FavoriteControllerState) {
  if (typeof window === "undefined") {
    return;
  }

  if (state.summaryState !== "failed") {
    window.localStorage.removeItem(storageKey(documentId));
    return;
  }

  window.localStorage.setItem(
    storageKey(documentId),
    JSON.stringify({
      errorMessage: state.summaryError,
    }),
  );
}

function defaultSummaryFailureMessage(document?: FavoriteDocument) {
  if (document?.ingestionStatus === IngestionStatus.FAILED) {
    return "Content capture failed, so a summary is not available yet.";
  }

  return "Summary generation failed. Try again later.";
}

function shouldHideSummaryUi(message?: string | null, code?: string | null) {
  if (code === "AI_PROVIDER_NOT_CONFIGURED") {
    return true;
  }

  const normalizedMessage = message?.trim().toLowerCase();
  if (!normalizedMessage) {
    return false;
  }

  return normalizedMessage.includes("not configured");
}
