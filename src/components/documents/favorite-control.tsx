"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { ApiError, ApiSuccess } from "@/server/api/response";
import { cx } from "@/utils/cx";
import type {
  DocumentDetail,
  DocumentListItem,
  UpdateDocumentFavoriteResponseData,
} from "@/server/modules/documents/document.types";

type FavoriteDocument = Pick<DocumentListItem, "id" | "isFavorite"> | Pick<DocumentDetail, "id" | "isFavorite">;

type FavoriteControllerState = {
  isFavorite: boolean;
};

type UpdateFavoriteApiResponse = ApiSuccess<UpdateDocumentFavoriteResponseData> | ApiError;

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

    setState(deriveStateFromDocument(document));
  }, [document.id, document.isFavorite, pendingAction]);

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
        throw new Error(localizeFavoriteError(payload.error.code));
      }

      setState(deriveStateFromResponse(payload.data));

      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setState(previousState);
      setActionError(error instanceof Error ? error.message : "更新收藏状态失败，请稍后再试。");
    } finally {
      setPendingAction(null);
    }
  }

  return {
    isFavorite: state.isFavorite,
    buttonLabel: formatFavoriteButtonLabel(state.isFavorite, pendingAction),
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
      className={cx(
        props.isFavorite ? "bg-[color:var(--bg-surface-strong)] text-[color:var(--text-primary)]" : undefined,
        props.className,
      )}
      disabled={props.isSubmitting}
      onClick={props.onClick}
    >
      <FavoriteStarIcon isFilled={props.isFavorite} />
      <span>{props.buttonLabel}</span>
    </Button>
  );
}

function FavoriteStarIcon({ isFilled }: { isFilled: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className="mr-1.5 h-4 w-4 shrink-0"
      fill={isFilled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
      viewBox="0 0 20 20"
    >
      <path d="M10 2.4 12.35 7.16l5.25.77-3.8 3.71.9 5.24L10 14.42l-4.7 2.46.9-5.24-3.8-3.71 5.25-.77Z" />
    </svg>
  );
}

function deriveStateFromDocument(document: FavoriteDocument): FavoriteControllerState {
  return {
    isFavorite: document.isFavorite,
  };
}

function deriveStateFromResponse(data: UpdateDocumentFavoriteResponseData): FavoriteControllerState {
  return {
    isFavorite: data.document.isFavorite,
  };
}

function formatFavoriteButtonLabel(
  isFavorite: boolean,
  pendingAction: "favorite" | "unfavorite" | null,
) {
  if (pendingAction === "favorite") {
    return "收藏中…";
  }

  if (pendingAction === "unfavorite") {
    return "取消收藏…";
  }

  return isFavorite ? "已收藏" : "收藏";
}

function localizeFavoriteError(code: string) {
  switch (code) {
    case "DOCUMENT_NOT_FOUND":
      return "文档不存在，无法更新收藏状态。";
    default:
      return "更新收藏状态失败，请稍后再试。";
  }
}
