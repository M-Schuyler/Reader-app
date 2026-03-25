"use client";

import { IngestionStatus } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { ApiError, ApiSuccess } from "@/server/api/response";
import type {
  DocumentDetail,
  DocumentListItem,
  UpdateDocumentFavoriteResponseData,
} from "@/server/modules/documents/document.types";

export type FavoriteSummaryUiState = "not_favorite" | "generating" | "ready" | "failed";

type FavoriteDocument = Pick<DocumentListItem, "id" | "isFavorite" | "aiSummary" | "excerpt" | "ingestionStatus"> |
  Pick<DocumentDetail, "id" | "isFavorite" | "aiSummary" | "excerpt" | "ingestionStatus">;

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
  }, [document.aiSummary, document.id, document.isFavorite, pendingAction]);

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
        body: JSON.stringify({ isFavorite: nextFavorite }),
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
      setActionError(error instanceof Error ? error.message : "收藏状态更新失败。");
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
    buttonLabel: formatFavoriteButtonLabel(state.isFavorite, pendingAction),
    isSubmitting: pendingAction !== null,
    actionError,
    toggleFavorite,
  };
}

export function FavoriteToggleButton(props: {
  buttonLabel: string;
  isFavorite: boolean;
  isSubmitting: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={
        props.isFavorite
          ? "rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm text-amber-800 transition hover:border-amber-400 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-70"
          : "rounded-full border border-black/15 bg-white px-3 py-1.5 text-sm text-black/70 transition hover:border-black/30 hover:text-black disabled:cursor-not-allowed disabled:opacity-70"
      }
      disabled={props.isSubmitting}
      onClick={props.onClick}
      type="button"
    >
      {props.buttonLabel}
    </button>
  );
}

export function FavoriteSummaryBadge({ state }: { state: FavoriteSummaryUiState }) {
  return (
    <span className={summaryBadgeClassName(state)}>
      {formatSummaryState(state)}
    </span>
  );
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

  if (persistedFailureState) {
    return {
      isFavorite: true,
      aiSummary: null,
      summaryState: "failed",
      summaryError: persistedFailureState.errorMessage ?? defaultSummaryFailureMessage(),
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

  if (data.summary.status === "failed") {
    return {
      isFavorite: true,
      aiSummary: null,
      summaryState: "failed",
      summaryError: data.summary.error?.message ?? defaultSummaryFailureMessage(),
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
  switch (state.summaryState) {
    case "ready":
      return state.aiSummary;
    case "generating":
      return "已收藏，AI 摘要生成中。";
    case "failed":
      return state.summaryError ?? defaultSummaryFailureMessage();
    case "not_favorite":
    default:
      return document.ingestionStatus === IngestionStatus.FAILED ? null : document.excerpt;
  }
}

function formatFavoriteButtonLabel(isFavorite: boolean, pendingAction: "favorite" | "unfavorite" | null) {
  if (pendingAction === "favorite") {
    return "收藏中...";
  }

  if (pendingAction === "unfavorite") {
    return "取消中...";
  }

  return isFavorite ? "已收藏" : "收藏";
}

function formatSummaryState(state: FavoriteSummaryUiState) {
  switch (state) {
    case "generating":
      return "已收藏，摘要生成中";
    case "ready":
      return "已收藏，摘要已生成";
    case "failed":
      return "已收藏，摘要生成失败";
    case "not_favorite":
    default:
      return "未收藏";
  }
}

function summaryBadgeClassName(state: FavoriteSummaryUiState) {
  switch (state) {
    case "generating":
      return "inline-flex rounded-full bg-stone-100 px-2.5 py-1 text-xs text-stone-700";
    case "ready":
      return "inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs text-emerald-700";
    case "failed":
      return "inline-flex rounded-full bg-red-50 px-2.5 py-1 text-xs text-red-700";
    case "not_favorite":
    default:
      return "inline-flex rounded-full bg-black/5 px-2.5 py-1 text-xs text-black/55";
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

function defaultSummaryFailureMessage() {
  return "AI 摘要生成失败，请稍后重试。";
}
