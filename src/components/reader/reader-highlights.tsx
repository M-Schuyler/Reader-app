"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { captureSelection, type CapturedSelection, type SelectionDraft } from "@/lib/highlights/selection";
import type { HighlightRecord } from "@/server/modules/highlights/highlight.types";
import { cx } from "@/utils/cx";

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
> & {
  isPending?: boolean;
};

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

  useEffect(() => {
    if (isLoading || highlights.length === 0 || typeof window === "undefined") {
      return;
    }

    const hash = window.location.hash;
    if (hash.startsWith("#highlight-")) {
      const id = hash.replace("#highlight-", "");
      if (highlights.some((h) => h.id === id)) {
        setFocusedHighlightId(id);
        
        // Use a timeout to ensure the DOM is ready for scrolling
        window.setTimeout(() => {
          const element = document.getElementById(`highlight-${id}`);
          if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" });
          }
        }, 100);
      }
    }
  }, [isLoading, highlights]);

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

    const optimisticHighlight = buildOptimisticHighlight(nextSelectionDraft);
    setHighlights((current) => sortHighlights([...current, optimisticHighlight]));
    window.getSelection()?.removeAllRanges();
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
        setHighlights((current) => current.filter((highlight) => highlight.id !== optimisticHighlight.id));
        setActionError("保存高亮失败，请稍后再试。");
        return null;
      }

      setHighlights((current) =>
        (() => {
          const optimisticHighlightIndex = current.findIndex((highlight) => highlight.id === optimisticHighlight.id);

          if (optimisticHighlightIndex === -1) {
            return sortHighlights([...current, payload.data.highlight]);
          }

          const nextHighlights = [...current];
          nextHighlights[optimisticHighlightIndex] = payload.data.highlight;
          return sortHighlights(nextHighlights);
        })(),
      );
      return payload.data.highlight;
    } catch {
      setHighlights((current) => current.filter((highlight) => highlight.id !== optimisticHighlight.id));
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
        return false;
      }

      setHighlights((current) =>
        sortHighlights(current.map((highlight) => (highlight.id === id ? payload.data.highlight : highlight))),
      );
      setActionError(null);
      return true;
    } catch {
      setActionError("更新批注失败，请稍后再试。");
      return false;
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
  onSaveNote: (id: string, note: string) => Promise<boolean>;
  savingNoteId: string | null;
};

const NOTE_EDITOR_TRANSITION_MS = 180;

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
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const closeEditorTimerRef = useRef<number | null>(null);
  const editorTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [editingHighlightId, setEditingHighlightId] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");

  const editingHighlight = editingHighlightId ? highlights.find((highlight) => highlight.id === editingHighlightId) ?? null : null;
  const isSavingEditingNote = editingHighlightId ? savingNoteId === editingHighlightId : false;

  function clearCloseEditorTimer() {
    if (closeEditorTimerRef.current !== null) {
      window.clearTimeout(closeEditorTimerRef.current);
      closeEditorTimerRef.current = null;
    }
  }

  function openNoteEditor(highlight: ReaderHighlight) {
    clearCloseEditorTimer();
    setEditingHighlightId(highlight.id);
    setNoteDraft(highlight.note ?? "");
    setIsEditorOpen(true);
  }

  function closeNoteEditor() {
    setIsEditorOpen(false);
    clearCloseEditorTimer();
    closeEditorTimerRef.current = window.setTimeout(() => {
      setEditingHighlightId(null);
      setNoteDraft("");
      closeEditorTimerRef.current = null;
    }, NOTE_EDITOR_TRANSITION_MS);
  }

  async function handleConfirmNoteSave() {
    if (!editingHighlight) {
      return;
    }

    const saved = await onSaveNote(editingHighlight.id, noteDraft);

    if (saved) {
      closeNoteEditor();
    }
  }

  function handleOverlayMouseDown(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) {
      closeNoteEditor();
    }
  }

  function registerCardRef(id: string, element: HTMLDivElement | null) {
    cardRefs.current[id] = element;
  }

  useEffect(() => {
    if (!focusedHighlightId) {
      return;
    }

    const targetCard = cardRefs.current[focusedHighlightId];
    const targetHighlight = highlights.find((highlight) => highlight.id === focusedHighlightId);

    if (!targetHighlight) {
      return;
    }

    targetCard?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    openNoteEditor(targetHighlight);
    onFocusedHighlightHandled();
  }, [focusedHighlightId, highlights, onFocusedHighlightHandled]);

  useEffect(() => {
    if (!isEditorOpen) {
      return;
    }

    const focusTimeoutId = window.setTimeout(() => {
      editorTextareaRef.current?.focus();
      editorTextareaRef.current?.setSelectionRange(noteDraft.length, noteDraft.length);
    }, 20);

    return () => {
      window.clearTimeout(focusTimeoutId);
    };
  }, [isEditorOpen, noteDraft]);

  useEffect(() => {
    if (!editingHighlightId) {
      return;
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeNoteEditor();
      }
    }

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, [editingHighlightId]);

  useEffect(() => {
    return () => {
      clearCloseEditorTimer();
    };
  }, []);

  return (
    <section className="space-y-4">
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
              cardRef={(element) => registerCardRef(highlight.id, element)}
              highlight={highlight}
              isEditing={editingHighlightId === highlight.id}
              isEditorOpen={isEditorOpen}
              isSaving={savingNoteId === highlight.id}
              key={highlight.id}
              onDelete={onDelete}
              onOpenEditor={openNoteEditor}
            />
          ))}
        </div>
      )}

      {editingHighlight ? (
        <div
          className={cx(
            "fixed inset-0 z-[72] flex items-center justify-center px-4 transition-opacity duration-200",
            isEditorOpen ? "pointer-events-auto bg-black/35 opacity-100" : "pointer-events-none bg-black/0 opacity-0",
          )}
          onMouseDown={handleOverlayMouseDown}
        >
          <Panel
            aria-modal="true"
            className={cx(
              "relative w-full max-w-[42rem] border-[color:var(--border-strong)] bg-[color:var(--bg-surface-strong)] p-6 transition-all duration-200 sm:p-7",
              isEditorOpen ? "translate-y-0 scale-100 opacity-100" : "translate-y-1 scale-[0.96] opacity-0",
            )}
            role="dialog"
          >
            <button
              aria-label="关闭批注弹窗"
              className="absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full text-lg leading-none text-[color:var(--text-tertiary)] transition hover:bg-[color:var(--button-quiet-hover-bg)] hover:text-[color:var(--text-primary)]"
              onClick={closeNoteEditor}
              type="button"
            >
              ×
            </button>

            <div className="space-y-5">
              <blockquote className="rounded-[18px] border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] px-4 py-3 text-sm leading-7 text-[color:var(--text-primary)]">
                “{editingHighlight.quoteText}”
              </blockquote>

              <textarea
                className="min-h-44 w-full rounded-[18px] border border-[color:var(--border-subtle)] bg-[color:var(--bg-field)] px-4 py-3.5 text-sm leading-7 text-[color:var(--text-primary)] outline-none transition focus:border-[color:var(--border-strong)] focus:bg-[color:var(--bg-field-focus)]"
                onChange={(event) => setNoteDraft(event.target.value)}
                placeholder="写下这段高亮的批注"
                ref={editorTextareaRef}
                value={noteDraft}
              />

              <div className="flex justify-end">
                <Button
                  disabled={isSavingEditingNote}
                  onClick={() => void handleConfirmNoteSave()}
                  size="sm"
                  variant="secondary"
                >
                  {isSavingEditingNote ? "保存中…" : "保存批注"}
                </Button>
              </div>
            </div>
          </Panel>
        </div>
      ) : null}
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

function buildOptimisticHighlight(draft: SelectionDraft): ReaderHighlight {
  return {
    id: `pending-highlight-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    quoteText: draft.quoteText,
    note: null,
    color: null,
    startOffset: draft.startOffset,
    endOffset: draft.endOffset,
    selectorJson: draft.selectorJson,
    isPending: true,
  };
}

function HighlightCard({
  cardRef,
  highlight,
  isEditing,
  isEditorOpen,
  isSaving,
  onDelete,
  onOpenEditor,
}: {
  cardRef: (element: HTMLDivElement | null) => void;
  highlight: ReaderHighlight;
  isEditing: boolean;
  isEditorOpen: boolean;
  isSaving: boolean;
  onDelete: (id: string) => Promise<void>;
  onOpenEditor: (highlight: ReaderHighlight) => void;
}) {
  const isPending = highlight.isPending === true;

  function handleTriggerMouseDown(event: MouseEvent<HTMLTextAreaElement>) {
    if (isPending) {
      return;
    }

    event.preventDefault();
    onOpenEditor(highlight);
  }

  function handleTriggerClick() {
    if (isPending) {
      return;
    }

    onOpenEditor(highlight);
  }

  return (
    <div
      className={cx(
        "space-y-3 rounded-[20px] border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface-strong)] p-4 transition-all duration-200",
        isEditing && isEditorOpen ? "scale-[1.02] opacity-0" : "scale-100 opacity-100",
      )}
      ref={cardRef}
    >
      <blockquote className="border-l border-[color:var(--border-strong)] pl-4 text-sm leading-7 text-[color:var(--text-primary)]">
        {highlight.quoteText}
      </blockquote>
      <textarea
        className="min-h-24 w-full rounded-[16px] border border-[color:var(--border-subtle)] bg-[color:var(--bg-field)] px-3.5 py-3 text-sm leading-6 text-[color:var(--text-primary)] outline-none transition focus:border-[color:var(--border-strong)] focus:bg-[color:var(--bg-field-focus)]"
        onClick={handleTriggerClick}
        onMouseDown={handleTriggerMouseDown}
        placeholder="写一句批注"
        readOnly
        value={highlight.note ?? ""}
      />
      <div className="flex items-center justify-between gap-3">
        <Button
          disabled={isPending}
          onClick={() => onOpenEditor(highlight)}
          size="sm"
          variant="secondary"
        >
          {isPending ? "保存中…" : "写批注"}
        </Button>
        <button
          disabled={isSaving || isPending}
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
