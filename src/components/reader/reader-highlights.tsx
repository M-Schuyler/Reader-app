"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { captureSelectionDraft, type SelectionDraft } from "@/lib/highlights/selection";
import type { HighlightRecord } from "@/server/modules/highlights/highlight.types";

type HighlightsApiResponse =
  | {
      ok: true;
      data: {
        items: HighlightRecord[];
      };
    }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
      };
    };

type HighlightMutationApiResponse =
  | {
      ok: true;
      data: {
        highlight: HighlightRecord;
      };
    }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
      };
    };

export type ReaderHighlight = Pick<
  HighlightRecord,
  "id" | "quoteText" | "note" | "color" | "startOffset" | "endOffset" | "selectorJson"
>;

type UseDocumentHighlightsInput = {
  canHighlight: boolean;
  documentId: string;
};

export function useDocumentHighlights({ canHighlight, documentId }: UseDocumentHighlightsInput) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [highlights, setHighlights] = useState<ReaderHighlight[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [selectionDraft, setSelectionDraft] = useState<SelectionDraft | null>(null);
  const [savingNoteId, setSavingNoteId] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    async function loadHighlights() {
      setIsLoading(true);
      setActionError(null);

      try {
        const response = await fetch(`/api/documents/${documentId}/highlights`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as HighlightsApiResponse;

        if (!payload.ok) {
          if (!isCancelled) {
            setActionError("加载高亮失败，请稍后再试。");
          }
          return;
        }

        if (!isCancelled) {
          setHighlights(payload.data.items);
        }
      } catch {
        if (!isCancelled) {
          setActionError("加载高亮失败，请稍后再试。");
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadHighlights();

    return () => {
      isCancelled = true;
    };
  }, [documentId]);

  const captureSelection = () => {
    if (!canHighlight || !contentRef.current || typeof window === "undefined") {
      return;
    }

    try {
      setSelectionDraft(captureSelectionDraft(contentRef.current));
      setActionError(null);
    } catch {
      setSelectionDraft(null);
    }
  };

  async function createHighlightFromSelection() {
    if (!selectionDraft) {
      return;
    }

    setIsCreating(true);
    setActionError(null);

    try {
      const response = await fetch(`/api/documents/${documentId}/highlights`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(selectionDraft),
      });

      const payload = (await response.json()) as HighlightMutationApiResponse;

      if (!payload.ok) {
        setActionError("保存高亮失败，请稍后再试。");
        return;
      }

      setHighlights((current) => sortHighlights([...current, payload.data.highlight]));
      setSelectionDraft(null);
      window.getSelection()?.removeAllRanges();
    } catch {
      setActionError("保存高亮失败，请稍后再试。");
    } finally {
      setIsCreating(false);
    }
  }

  async function saveHighlightNote(id: string, note: string) {
    setSavingNoteId(id);
    setActionError(null);

    try {
      const response = await fetch(`/api/highlights/${id}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ note }),
      });

      const payload = (await response.json()) as HighlightMutationApiResponse;

      if (!payload.ok) {
        setActionError("更新批注失败，请稍后再试。");
        return;
      }

      setHighlights((current) =>
        sortHighlights(current.map((highlight) => (highlight.id === id ? payload.data.highlight : highlight))),
      );
    } catch {
      setActionError("更新批注失败，请稍后再试。");
    } finally {
      setSavingNoteId(null);
    }
  }

  async function removeHighlightById(id: string) {
    setActionError(null);

    try {
      const response = await fetch(`/api/highlights/${id}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as { ok: boolean; error?: { message: string } };

      if (!payload.ok) {
        setActionError("删除高亮失败，请稍后再试。");
        return;
      }

      setHighlights((current) => current.filter((highlight) => highlight.id !== id));
    } catch {
      setActionError("删除高亮失败，请稍后再试。");
    }
  }

  return {
    actionError,
    captureSelection,
    contentRef,
    createHighlightFromSelection,
    highlights,
    isCreating,
    isLoading,
    removeHighlightById,
    saveHighlightNote,
    savingNoteId,
    selectionDraft,
  };
}

type ReaderHighlightsPanelProps = {
  actionError: string | null;
  highlights: ReaderHighlight[];
  isLoading: boolean;
  onDelete: (id: string) => Promise<void>;
  onSaveNote: (id: string, note: string) => Promise<void>;
  savingNoteId: string | null;
};

export function ReaderHighlightsPanel({
  actionError,
  highlights,
  isLoading,
  onDelete,
  onSaveNote,
  savingNoteId,
}: ReaderHighlightsPanelProps) {
  return (
    <Panel className="space-y-4" tone="muted">
      <div className="space-y-2">
        <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[color:var(--text-tertiary)]">
          Highlights
        </p>
        <p className="text-sm leading-7 text-[color:var(--text-secondary)]">
          只留下值得回看的句子，批注保持短而清楚。
        </p>
      </div>

      {actionError ? <p className="text-sm leading-6 text-[color:var(--badge-danger-text)]">{actionError}</p> : null}

      {isLoading ? (
        <p className="text-sm leading-6 text-[color:var(--text-secondary)]">正在加载高亮…</p>
      ) : highlights.length === 0 ? (
        <p className="text-sm leading-7 text-[color:var(--text-secondary)]">
          还没有高亮。在阅读页选中一段文字后，这里会出现第一条。
        </p>
      ) : (
        <div className="space-y-4">
          {highlights.map((highlight) => (
            <HighlightCard
              highlight={highlight}
              isSaving={savingNoteId === highlight.id}
              key={highlight.id}
              onDelete={onDelete}
              onSaveNote={onSaveNote}
            />
          ))}
        </div>
      )}
    </Panel>
  );
}

function sortHighlights(highlights: ReaderHighlight[]) {
  return [...highlights].sort((left, right) => {
    const leftStart = left.startOffset ?? Number.MAX_SAFE_INTEGER;
    const rightStart = right.startOffset ?? Number.MAX_SAFE_INTEGER;

    if (leftStart !== rightStart) {
      return leftStart - rightStart;
    }

    return left.quoteText.localeCompare(right.quoteText);
  });
}

function HighlightCard({
  highlight,
  isSaving,
  onDelete,
  onSaveNote,
}: {
  highlight: ReaderHighlight;
  isSaving: boolean;
  onDelete: (id: string) => Promise<void>;
  onSaveNote: (id: string, note: string) => Promise<void>;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleSaveNote() {
    const nextNote = textareaRef.current?.value ?? highlight.note ?? "";
    void onSaveNote(highlight.id, nextNote);
  }

  return (
    <div className="space-y-3 rounded-[20px] border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface-strong)] p-4">
      <blockquote className="border-l border-[color:var(--border-strong)] pl-4 text-sm leading-7 text-[color:var(--text-primary)]">
        {highlight.quoteText}
      </blockquote>
      <textarea
        className="min-h-24 w-full rounded-[16px] border border-[color:var(--border-subtle)] bg-white px-3.5 py-3 text-sm leading-6 text-[color:var(--text-primary)] outline-none transition focus:border-[color:var(--border-strong)]"
        defaultValue={highlight.note ?? ""}
        placeholder="写一句批注"
        ref={textareaRef}
      />
      <div className="flex items-center justify-between gap-3">
        <Button
          disabled={isSaving}
          onClick={handleSaveNote}
          size="sm"
          variant="secondary"
        >
          {isSaving ? "保存中…" : "保存批注"}
        </Button>
        <button
          className="text-sm font-medium text-[color:var(--text-secondary)] transition hover:text-[color:var(--badge-danger-text)]"
          onClick={() => void onDelete(highlight.id)}
          type="button"
        >
          删除
        </button>
      </div>
    </div>
  );
}
