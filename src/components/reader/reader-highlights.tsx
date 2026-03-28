"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { captureSelection, type CapturedSelection, type SelectionDraft } from "@/lib/highlights/selection";
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

type ReadSelectionOptions = {
  point?: {
    x: number;
    y: number;
  };
};

type UseDocumentHighlightsInput = {
  canHighlight: boolean;
  documentId: string;
};

export function useDocumentHighlights({ canHighlight, documentId }: UseDocumentHighlightsInput) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [focusedHighlightId, setFocusedHighlightId] = useState<string | null>(null);
  const [highlights, setHighlights] = useState<ReaderHighlight[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [savingNoteId, setSavingNoteId] = useState<string | null>(null);

  useEffect(() => {
    if (!canHighlight) {
      setActionError(null);
      setFocusedHighlightId(null);
      setHighlights([]);
      setIsLoading(false);
      return;
    }

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
  }, [canHighlight, documentId]);

  function readSelection(options?: ReadSelectionOptions): CapturedSelection | null {
    if (!canHighlight || !contentRef.current || typeof window === "undefined") {
      return null;
    }

    try {
      setActionError(null);
      return captureSelection(contentRef.current, options);
    } catch {
      return null;
    }
  }

  function requestHighlightNoteFocus(id: string) {
    setFocusedHighlightId(id);
  }

  function clearFocusedHighlight() {
    setFocusedHighlightId(null);
  }

  async function createHighlightFromSelection(selectionDraft?: SelectionDraft | null) {
    const nextSelectionDraft = selectionDraft ?? readSelection()?.draft;

    if (!nextSelectionDraft) {
      return null;
    }

    setIsCreating(true);
    setActionError(null);

    try {
      const response = await fetch(`/api/documents/${documentId}/highlights`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(nextSelectionDraft),
      });

      const payload = (await response.json()) as HighlightMutationApiResponse;

      if (!payload.ok) {
        setActionError("保存高亮失败，请稍后再试。");
        return null;
      }

      setHighlights((current) => sortHighlights([...current, payload.data.highlight]));
      window.getSelection()?.removeAllRanges();
      return payload.data.highlight;
    } catch {
      setActionError("保存高亮失败，请稍后再试。");
      return null;
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
      setActionError(null);
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

      if (focusedHighlightId === id) {
        setFocusedHighlightId(null);
      }

      setHighlights((current) => current.filter((highlight) => highlight.id !== id));
    } catch {
      setActionError("删除高亮失败，请稍后再试。");
    }
  }

  return {
    actionError,
    clearFocusedHighlight,
    contentRef,
    createHighlightFromSelection,
    focusedHighlightId,
    highlights,
    isCreating,
    isLoading,
    readSelection,
    removeHighlightById,
    requestHighlightNoteFocus,
    saveHighlightNote,
    savingNoteId,
  };
}

type ReaderHighlightsPanelProps = {
  actionError: string | null;
  focusedHighlightId: string | null;
  highlights: ReaderHighlight[];
  isLoading: boolean;
  onDelete: (id: string) => Promise<void>;
  onFocusedHighlightHandled: () => void;
  onSaveNote: (id: string, note: string) => Promise<void>;
  savingNoteId: string | null;
};

export function ReaderHighlightsPanel({
  actionError,
  focusedHighlightId,
  highlights,
  isLoading,
  onDelete,
  onFocusedHighlightHandled,
  onSaveNote,
  savingNoteId,
}: ReaderHighlightsPanelProps) {
  const noteRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  useEffect(() => {
    if (!focusedHighlightId) {
      return;
    }

    const noteTarget = noteRefs.current[focusedHighlightId];

    if (!noteTarget) {
      return;
    }

    noteTarget.scrollIntoView({ behavior: "smooth", block: "nearest" });
    noteTarget.focus();
    noteTarget.setSelectionRange(noteTarget.value.length, noteTarget.value.length);
    onFocusedHighlightHandled();
  }, [focusedHighlightId, highlights, onFocusedHighlightHandled]);

  return (
    <section className="space-y-4 border-t border-[color:var(--border-subtle)] pt-5">
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
              autoFocusNote={highlight.id === focusedHighlightId}
              highlight={highlight}
              isSaving={savingNoteId === highlight.id}
              key={highlight.id}
              noteRef={(element) => {
                noteRefs.current[highlight.id] = element;
              }}
              onDelete={onDelete}
              onSaveNote={onSaveNote}
            />
          ))}
        </div>
      )}
    </section>
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
  autoFocusNote,
  highlight,
  isSaving,
  noteRef,
  onDelete,
  onSaveNote,
}: {
  autoFocusNote: boolean;
  highlight: ReaderHighlight;
  isSaving: boolean;
  noteRef: (element: HTMLTextAreaElement | null) => void;
  onDelete: (id: string) => Promise<void>;
  onSaveNote: (id: string, note: string) => Promise<void>;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  function handleTextareaRef(element: HTMLTextAreaElement | null) {
    textareaRef.current = element;
    noteRef(element);
  }

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
        className="min-h-24 w-full rounded-[16px] border border-[color:var(--border-subtle)] bg-[color:var(--bg-field)] px-3.5 py-3 text-sm leading-6 text-[color:var(--text-primary)] outline-none transition focus:border-[color:var(--border-strong)] focus:bg-[color:var(--bg-field-focus)]"
        data-note-focus-target={autoFocusNote ? "true" : undefined}
        defaultValue={highlight.note ?? ""}
        placeholder="写一句批注"
        ref={handleTextareaRef}
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
