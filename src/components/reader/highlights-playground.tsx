"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { ReaderHighlightsPanel, type ReaderHighlight } from "@/components/reader/reader-highlights";
import { ReaderRichContent } from "@/components/reader/reader-rich-content";
import { captureSelectionDraft, type SelectionDraft } from "@/lib/highlights/selection";

const STORAGE_KEY = "reader-highlights-playground.v1";

const sampleSourceUrl = "https://reader.local/highlights-lab";

const sampleContentHtml = `
  <article>
    <p data-qa="inline-sample">
      Reader keeps <strong>structure</strong> intact across inline passages so highlight anchors stay readable.
    </p>
    <p>
      A useful highlight should survive refresh, allow a short note, and stay visually quiet inside the reading column.
      The goal here is not more chrome, but a calmer trace you can come back to later.
    </p>
    <blockquote>
      Keep the passage small enough to be worth exporting, and specific enough to be worth revisiting.
    </blockquote>
    <ul>
      <li>Selection should feel direct.</li>
      <li>Whitespace should not collapse across inline nodes.</li>
      <li>Notes should stay attached to the passage.</li>
    </ul>
  </article>
`;

const sampleFallbackText = `
Reader keeps structure intact across inline passages so highlight anchors stay readable.

A useful highlight should survive refresh, allow a short note, and stay visually quiet inside the reading column. The goal here is not more chrome, but a calmer trace you can come back to later.

Keep the passage small enough to be worth exporting, and specific enough to be worth revisiting.
`.trim();

export function HighlightsPlayground() {
  const contentRef = useRef<HTMLDivElement>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [highlights, setHighlights] = useState<ReaderHighlight[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [savingNoteId, setSavingNoteId] = useState<string | null>(null);
  const [selectionDraft, setSelectionDraft] = useState<SelectionDraft | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const storedValue = window.localStorage.getItem(STORAGE_KEY);
      if (storedValue) {
        setHighlights(sortHighlights(JSON.parse(storedValue) as ReaderHighlight[]));
      }
    } catch {
      setActionError("Failed to restore stored highlights.");
    } finally {
      setIsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!isHydrated || typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(highlights));
  }, [highlights, isHydrated]);

  const statsLabel = useMemo(() => {
    if (highlights.length === 0) {
      return "No saved traces yet.";
    }

    return `${highlights.length} saved passage${highlights.length === 1 ? "" : "s"}.`;
  }, [highlights.length]);

  function captureSelection() {
    if (!contentRef.current) {
      return;
    }

    try {
      setSelectionDraft(captureSelectionDraft(contentRef.current));
      setActionError(null);
    } catch {
      setSelectionDraft(null);
      setActionError("Selection could not be anchored.");
    }
  }

  async function createHighlight() {
    if (!selectionDraft) {
      return;
    }

    setIsCreating(true);

    try {
      const nextHighlight: ReaderHighlight = {
        id: `lab-${globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36)}`,
        quoteText: selectionDraft.quoteText,
        note: null,
        color: null,
        startOffset: selectionDraft.startOffset,
        endOffset: selectionDraft.endOffset,
        selectorJson: selectionDraft.selectorJson,
      };

      setHighlights((current) => sortHighlights([...current, nextHighlight]));
      setSelectionDraft(null);
      window.getSelection()?.removeAllRanges();
      setActionError(null);
    } finally {
      setIsCreating(false);
    }
  }

  async function saveNote(id: string, note: string) {
    setSavingNoteId(id);
    setHighlights((current) =>
      sortHighlights(current.map((highlight) => (highlight.id === id ? { ...highlight, note } : highlight))),
    );
    setSavingNoteId(null);
  }

  async function deleteHighlight(id: string) {
    setHighlights((current) => current.filter((highlight) => highlight.id !== id));
  }

  function resetHighlights() {
    setHighlights([]);
    setSelectionDraft(null);
    setActionError(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
      window.getSelection()?.removeAllRanges();
    }
  }

  return (
    <main className="min-h-screen bg-[color:var(--bg-canvas)] px-6 py-10 sm:px-10">
      <div className="mx-auto max-w-[74rem] space-y-10">
        <PageHeader
          eyebrow="QA"
          title="Highlights lab"
          description="Use this playground to verify selection anchoring, note editing, deletion, and refresh persistence before we score the feature as production-ready."
          actions={
            <Button onClick={resetHighlights} size="sm" variant="secondary">
              Reset saved traces
            </Button>
          }
        />

        <div className="grid gap-8 lg:grid-cols-[minmax(0,var(--content-measure))_19rem] lg:justify-center">
          <Panel className="overflow-hidden" padding="none">
            <div className="space-y-4 px-7 py-8 sm:px-10 sm:py-10">
              <div className="flex flex-wrap items-center gap-3 text-sm text-[color:var(--text-secondary)]">
                <span>{statsLabel}</span>
                <span>Refresh should keep local QA state intact.</span>
              </div>

              <div
                data-qa="highlight-content"
                onKeyUp={captureSelection}
                onMouseUp={captureSelection}
                onTouchEnd={captureSelection}
                ref={contentRef}
              >
                <ReaderRichContent
                  contentHtml={sampleContentHtml}
                  fallbackText={sampleFallbackText}
                  highlights={highlights}
                  sourceUrl={sampleSourceUrl}
                />
              </div>

              {selectionDraft ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] px-4 py-3">
                  <div className="space-y-1">
                    <p className="text-sm leading-6 text-[color:var(--text-secondary)]">Selection ready to save.</p>
                    <p className="text-sm leading-6 text-[color:var(--text-primary)]" data-qa="selection-preview">
                      “{selectionDraft.quoteText}”
                    </p>
                  </div>
                  <Button data-qa="save-highlight" disabled={isCreating} onClick={createHighlight} size="sm" variant="secondary">
                    {isCreating ? "Saving…" : "Save highlight"}
                  </Button>
                </div>
              ) : null}

              {actionError ? (
                <p className="text-sm leading-6 text-[color:var(--badge-danger-text)]">{actionError}</p>
              ) : null}
            </div>
          </Panel>

          <ReaderHighlightsPanel
            actionError={actionError}
            focusedHighlightId={null}
            highlights={highlights}
            isLoading={!isHydrated}
            onDelete={deleteHighlight}
            onFocusedHighlightHandled={() => {}}
            onSaveNote={saveNote}
            savingNoteId={savingNoteId}
          />
        </div>
      </div>
    </main>
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
