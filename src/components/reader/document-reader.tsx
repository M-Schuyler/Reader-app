"use client";

import { useEffect, useRef, useState, type MouseEvent, type RefObject } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { IngestionStatus } from "@prisma/client";
import { DocumentTagPills } from "@/components/documents/document-tag-pills";
import { FavoriteToggleButton, useDocumentFavoriteController } from "@/components/documents/favorite-control";
import { HighlightSaveModeToggle } from "@/components/reader/highlight-save-mode-toggle";
import { ReaderHighlightsPanel, useDocumentHighlights } from "@/components/reader/reader-highlights";
import { ReaderRichContent } from "@/components/reader/reader-rich-content";
import { ReaderAutoHighlightFeedback, ReaderSelectionActions } from "@/components/reader/reader-selection-actions";
import { useDocumentReadCompletion, type DocumentReadCompletionPhase } from "@/components/reader/use-document-read-completion";
import { usePrioritizedDocumentAiSummary } from "@/components/reader/use-prioritized-document-ai-summary";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/ui/panel";
import { resolveDocumentLead } from "@/lib/documents/document-lead";
import { resolveDocumentFailedState } from "@/lib/documents/document-failed-state";
import { formatPublishedAtLabel, resolveDocumentDateMetaLabel } from "@/lib/documents/published-at";
import {
  HIGHLIGHT_SAVE_MODE_STORAGE_KEY,
  READER_FONT_SIZE_STORAGE_KEY,
  READER_LINE_HEIGHT_STORAGE_KEY,
  normalizeHighlightSaveMode,
  normalizeReaderFontSizePreference,
  normalizeReaderLineHeightPreference,
  resolveReaderFontSizePreferenceValue,
  resolveReaderLineHeightPreferenceValue,
  type HighlightSaveMode,
  type ReaderFontSizePreference,
  type ReaderLineHeightPreference,
} from "@/lib/highlights/preferences";
import type { CapturedSelection, SelectionAnchor } from "@/lib/highlights/selection";
import type { DocumentDetail } from "@/server/modules/documents/document.types";
import { cx } from "@/utils/cx";

type DocumentReaderProps = {
  document: DocumentDetail;
};

type SelectionTrigger = "contextmenu" | "keyboard" | "mouse" | "touch";

type ReaderSelectionState = CapturedSelection & {
  trigger: SelectionTrigger;
};

type AutoHighlightFeedback = {
  anchor: SelectionAnchor;
  highlightId: string;
};

type ReaderFloatingPanelTab = "highlights" | "actions" | "meta";

export function DocumentReader({ document: initialDocument }: DocumentReaderProps) {
  const readerDocument = usePrioritizedDocumentAiSummary(initialDocument);
  const selectionActionsRef = useRef<HTMLDivElement>(null);
  const floatingPanelButtonRef = useRef<HTMLButtonElement>(null);
  const floatingPanelRef = useRef<HTMLDivElement>(null);
  const suppressNativeContextMenuRef = useRef(false);
  const sourceUrl = readerDocument.sourceUrl ?? readerDocument.canonicalUrl;
  const contentHtml = readerDocument.content?.contentHtml?.trim() ?? null;
  const plainText = readerDocument.content?.plainText ?? "";
  const hasExtractedContent = Boolean(contentHtml || plainText.trim());
  const isFailed = readerDocument.ingestionStatus === IngestionStatus.FAILED;
  const isReadable = !isFailed && hasExtractedContent;
  const favorite = useDocumentFavoriteController(readerDocument);
  const readCompletion = useDocumentReadCompletion({
    documentId: readerDocument.id,
    isEnabled: isReadable,
    readState: readerDocument.readState,
  });
  const [autoHighlightFeedback, setAutoHighlightFeedback] = useState<AutoHighlightFeedback | null>(null);
  const [highlightSaveMode, setHighlightSaveMode] = useState<HighlightSaveMode>("manual");
  const [readerFontSize, setReaderFontSize] = useState<ReaderFontSizePreference>("medium");
  const [readerLineHeight, setReaderLineHeight] = useState<ReaderLineHeightPreference>("comfortable");
  const [floatingPanelTab, setFloatingPanelTab] = useState<ReaderFloatingPanelTab>("highlights");
  const [isFloatingPanelOpen, setIsFloatingPanelOpen] = useState(false);
  const [headerToggleSlot, setHeaderToggleSlot] = useState<HTMLElement | null>(null);
  const [selectionState, setSelectionState] = useState<ReaderSelectionState | null>(null);
  const documentHighlights = useDocumentHighlights({
    canHighlight: isReadable,
    documentId: readerDocument.id,
  });
  const lead = resolveDocumentLead(readerDocument);
  const failedState = resolveDocumentFailedState(readerDocument.ingestion?.error);
  const showIngestionBadge = readerDocument.ingestionStatus !== IngestionStatus.READY;
  const documentAttribution = resolveDocumentAttribution(readerDocument);
  const markdownDownloadHref = `/api/documents/${readerDocument.id}/download?format=markdown`;
  const htmlDownloadHref = `/api/documents/${readerDocument.id}/download?format=html`;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    setHighlightSaveMode(normalizeHighlightSaveMode(window.localStorage.getItem(HIGHLIGHT_SAVE_MODE_STORAGE_KEY)));
    setReaderFontSize(normalizeReaderFontSizePreference(window.localStorage.getItem(READER_FONT_SIZE_STORAGE_KEY)));
    setReaderLineHeight(normalizeReaderLineHeightPreference(window.localStorage.getItem(READER_LINE_HEIGHT_STORAGE_KEY)));
  }, []);

  useEffect(() => {
    if (!isReadable) {
      setAutoHighlightFeedback(null);
      setSelectionState(null);
    }
  }, [isReadable]);

  useEffect(() => {
    if (!selectionState || selectionState.trigger === "contextmenu") {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;

      if (target instanceof Node && selectionActionsRef.current?.contains(target)) {
        return;
      }

      setSelectionState(null);
    }

    function handleViewportChange() {
      setSelectionState(null);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [selectionState]);

  useEffect(() => {
    if (!autoHighlightFeedback) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setAutoHighlightFeedback(null);
    }, 2600);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [autoHighlightFeedback]);

  useEffect(() => {
    if (!isFloatingPanelOpen) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;

      if (!(target instanceof Node)) {
        setIsFloatingPanelOpen(false);
        return;
      }

      if (floatingPanelRef.current?.contains(target) || floatingPanelButtonRef.current?.contains(target)) {
        return;
      }

      setIsFloatingPanelOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsFloatingPanelOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFloatingPanelOpen]);

  useEffect(() => {
    if (!documentHighlights.focusedHighlightId) {
      return;
    }

    setFloatingPanelTab("highlights");
    setIsFloatingPanelOpen(true);
  }, [documentHighlights.focusedHighlightId]);

  useEffect(() => {
    setHeaderToggleSlot(document.getElementById("reader-panel-toggle-slot"));
  }, []);

  useEffect(() => {
    if (!headerToggleSlot) {
      return;
    }

    if (isFloatingPanelOpen) {
      headerToggleSlot.setAttribute("data-panel-open", "true");
      return;
    }

    headerToggleSlot.removeAttribute("data-panel-open");
  }, [headerToggleSlot, isFloatingPanelOpen]);

  function persistHighlightSaveMode(nextMode: HighlightSaveMode) {
    setHighlightSaveMode(nextMode);
    setSelectionState(null);
    setAutoHighlightFeedback(null);

    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(HIGHLIGHT_SAVE_MODE_STORAGE_KEY, nextMode);
  }

  function persistReaderFontSize(nextValue: ReaderFontSizePreference) {
    setReaderFontSize(nextValue);

    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(READER_FONT_SIZE_STORAGE_KEY, nextValue);
  }

  function persistReaderLineHeight(nextValue: ReaderLineHeightPreference) {
    setReaderLineHeight(nextValue);

    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(READER_LINE_HEIGHT_STORAGE_KEY, nextValue);
  }

  function readSelectionState(trigger: SelectionTrigger, point?: { x: number; y: number }): ReaderSelectionState | null {
    const nextSelection = documentHighlights.readSelection(point ? { point } : undefined);

    if (!nextSelection) {
      return null;
    }

    return {
      ...nextSelection,
      trigger,
    };
  }

  function handleSelectionCapture(trigger: Exclude<SelectionTrigger, "contextmenu">) {
    const nextSelection = readSelectionState(trigger);

    if (!nextSelection) {
      setSelectionState(null);
      return;
    }

    setAutoHighlightFeedback(null);

    if (highlightSaveMode === "auto" && trigger !== "keyboard") {
      setSelectionState(null);
      void handleAutoHighlight(nextSelection);
      return;
    }

    if (trigger === "mouse") {
      setSelectionState(null);
      return;
    }

    setSelectionState(nextSelection);
  }

  function handleSelectionMouseDown(event: MouseEvent<HTMLDivElement>) {
    if (event.button !== 2 || !isReadable || highlightSaveMode === "auto") {
      return;
    }

    const nextSelection = readSelectionState("contextmenu", {
      x: event.clientX,
      y: event.clientY,
    });

    if (!nextSelection) {
      suppressNativeContextMenuRef.current = false;
      return;
    }

    event.preventDefault();
    suppressNativeContextMenuRef.current = true;
    setAutoHighlightFeedback(null);
    setSelectionState(nextSelection);
  }

  function handleSelectionContextMenu(event: MouseEvent<HTMLDivElement>) {
    if (suppressNativeContextMenuRef.current) {
      event.preventDefault();
      suppressNativeContextMenuRef.current = false;
      return;
    }

    if (!isReadable || highlightSaveMode === "auto") {
      return;
    }

    const nextSelection = readSelectionState("contextmenu", {
      x: event.clientX,
      y: event.clientY,
    });

    if (!nextSelection) {
      return;
    }

    event.preventDefault();
    setAutoHighlightFeedback(null);
    setSelectionState(nextSelection);
  }

  function handleSelectionMouseUp(event: MouseEvent<HTMLDivElement>) {
    if (event.button !== 0 || suppressNativeContextMenuRef.current) {
      return;
    }

    handleSelectionCapture("mouse");
  }

  async function handleAutoHighlight(nextSelection: ReaderSelectionState) {
    const createdHighlight = await documentHighlights.createHighlightFromSelection(nextSelection.draft);

    if (!createdHighlight) {
      return;
    }

    setAutoHighlightFeedback({
      anchor: nextSelection.anchor,
      highlightId: createdHighlight.id,
    });
  }

  async function handleCreateHighlight() {
    if (!selectionState) {
      return;
    }

    const createdHighlight = await documentHighlights.createHighlightFromSelection(selectionState.draft);

    if (!createdHighlight) {
      return;
    }

    setSelectionState(null);
  }

  async function handleCreateHighlightNote() {
    if (!selectionState) {
      return;
    }

    const createdHighlight = await documentHighlights.createHighlightFromSelection(selectionState.draft);

    if (!createdHighlight) {
      return;
    }

    setSelectionState(null);
    documentHighlights.requestHighlightNoteFocus(createdHighlight.id);
  }

  function handleAutoHighlightNote() {
    if (!autoHighlightFeedback) {
      return;
    }

    setFloatingPanelTab("highlights");
    setIsFloatingPanelOpen(true);
    documentHighlights.requestHighlightNoteFocus(autoHighlightFeedback.highlightId);
    setAutoHighlightFeedback(null);
  }

  function toggleFloatingPanel() {
    setIsFloatingPanelOpen((current) => !current);
  }

  function selectFloatingPanelTab(tab: ReaderFloatingPanelTab) {
    setFloatingPanelTab(tab);
    setIsFloatingPanelOpen(true);
  }

  return (
    <section className="space-y-9 lg:space-y-10">
      <header className="mx-auto max-w-[var(--content-measure)] space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-medium uppercase tracking-[0.24em] text-[color:var(--text-tertiary)]">
          <Link className="transition hover:text-[color:var(--text-primary)]" href="/reading">
            Reading
          </Link>
          <span>/</span>
          <span>{formatDocumentType(readerDocument.type)}</span>
          {showIngestionBadge ? (
            <Badge tone={statusTone(readerDocument.ingestionStatus)}>{formatIngestionStatus(readerDocument.ingestionStatus)}</Badge>
          ) : null}
        </div>

        <div className="space-y-3">
          <h1 className="font-display text-[2.85rem] leading-[1.02] tracking-[-0.045em] text-[color:var(--text-primary)] sm:text-[4.1rem]">
            {readerDocument.title}
          </h1>
          {documentAttribution ? (
            <p className="text-sm text-[color:var(--text-tertiary)]">{`${documentAttribution.label} · ${documentAttribution.value}`}</p>
          ) : null}
          {lead.text ? (
            <div className="max-w-[38rem] space-y-2">
              {lead.label ? (
                <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[color:var(--text-tertiary)]">
                  {lead.label}
                </p>
              ) : null}
              <p className="text-[1.02rem] leading-8 text-[color:var(--text-secondary)]">{lead.text}</p>
              {lead.note ? <p className="text-sm leading-7 text-[color:var(--text-tertiary)]">{lead.note}</p> : null}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-[color:var(--text-tertiary)]">
          <span>{formatPublishedAtLabel(readerDocument.publishedAt, readerDocument.publishedAtKind, readerDocument.createdAt)}</span>
          {readerDocument.lang ? <span>{readerDocument.lang}</span> : null}
          {isReadable && readerDocument.content?.wordCount ? <span>{formatWordCount(readerDocument.content.wordCount)}</span> : null}
        </div>
      </header>

      <div className="mx-auto max-w-[var(--content-measure)]">
        <Panel
          className="overflow-hidden border-[color:var(--border-subtle)] bg-[color:var(--bg-surface-strong)] shadow-[var(--shadow-surface-muted)]"
          padding="none"
          tone="transparent"
        >
          <div className="px-7 py-9 sm:px-11 sm:py-11">
            {isFailed ? (
              <div className="space-y-6">
                <div className="space-y-3">
                  <h2 className="font-display text-[2rem] leading-tight tracking-[-0.03em] text-[color:var(--text-primary)]">
                    {failedState.title}
                  </h2>
                  <p className="max-w-2xl text-[15px] leading-7 text-[color:var(--text-secondary)]">
                    {failedState.description}
                  </p>
                  <p className="max-w-2xl text-sm leading-7 text-[color:var(--text-tertiary)]">{failedState.nextStep}</p>
                </div>

                {sourceUrl ? (
                  <div className="space-y-3 rounded-[22px] border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] px-5 py-4">
                    <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[color:var(--text-tertiary)]">
                      原始链接
                    </p>
                    <p className="break-all text-sm leading-7 text-[color:var(--text-secondary)]">{sourceUrl}</p>
                    <Link
                      className="inline-flex min-h-10 items-center rounded-[18px] border border-[color:var(--border-strong)] bg-[color:var(--bg-surface-strong)] px-4 text-sm font-medium text-[color:var(--text-primary)] transition hover:border-[color:var(--text-primary)] hover:bg-[color:var(--button-secondary-hover-bg)]"
                      href={sourceUrl}
                      target="_blank"
                    >
                      打开原文
                    </Link>
                  </div>
                ) : null}
              </div>
            ) : isReadable ? (
              <div className="space-y-4">
                <div
                  onContextMenu={handleSelectionContextMenu}
                  onKeyUp={() => handleSelectionCapture("keyboard")}
                  onMouseDown={handleSelectionMouseDown}
                  onMouseUp={handleSelectionMouseUp}
                  onTouchEnd={() => handleSelectionCapture("touch")}
                  ref={documentHighlights.contentRef}
                >
                  <ReaderRichContent
                    contentHtml={contentHtml ?? ""}
                    fallbackText={plainText}
                    fontSize={resolveReaderFontSizePreferenceValue(readerFontSize)}
                    highlights={documentHighlights.highlights}
                    lineHeight={resolveReaderLineHeightPreferenceValue(readerLineHeight)}
                    sourceUrl={sourceUrl}
                  />
                </div>

                {readCompletion.isVisible ? (
                  <ReaderReadCompletionFooter phase={readCompletion.phase} sentinelRef={readCompletion.sentinelRef} />
                ) : null}

                {documentHighlights.actionError ? (
                  <p className="text-sm leading-6 text-[color:var(--badge-danger-text)]">{documentHighlights.actionError}</p>
                ) : null}
              </div>
            ) : (
              <p className="text-[15px] leading-7 text-[color:var(--text-secondary)]">
                文档已保存，但暂时没有可阅读正文。
              </p>
            )}
          </div>
        </Panel>
      </div>

      {headerToggleSlot
        ? createPortal(
            <button
              aria-expanded={isFloatingPanelOpen}
              aria-label="打开阅读浮动面板"
              className={cx(
                "relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-stone-200 bg-transparent text-[color:var(--text-primary)] transition-colors hover:bg-stone-100",
                isFloatingPanelOpen ? "bg-stone-100" : undefined,
              )}
              onClick={toggleFloatingPanel}
              ref={floatingPanelButtonRef}
              type="button"
            >
              <LayersIcon />
              {documentHighlights.highlights.length > 0 ? (
                <span className="absolute -right-1 -top-1 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-[color:var(--text-primary)] px-1 text-[10px] font-semibold leading-none text-white">
                  {documentHighlights.highlights.length}
                </span>
              ) : null}
            </button>,
            headerToggleSlot,
          )
        : null}

      <div
        className={cx(
          "fixed right-4 top-[60px] z-50 w-[min(92vw,360px)] origin-top-right transition-all duration-200",
          isFloatingPanelOpen
            ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
            : "pointer-events-none -translate-y-2 scale-[0.98] opacity-0",
        )}
        ref={floatingPanelRef}
      >
        <Panel className="max-h-[calc(100vh-80px)] overflow-y-auto border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] shadow-[var(--shadow-surface)]">
            <div className="flex items-center gap-2 border-b border-[color:var(--border-subtle)] pb-3">
              <FloatingTabButton
                active={floatingPanelTab === "highlights"}
                label="高亮"
                onClick={() => selectFloatingPanelTab("highlights")}
              />
              <FloatingTabButton
                active={floatingPanelTab === "actions"}
                label="操作"
                onClick={() => selectFloatingPanelTab("actions")}
              />
              <FloatingTabButton
                active={floatingPanelTab === "meta"}
                label="文档信息"
                onClick={() => selectFloatingPanelTab("meta")}
              />
            </div>

            <div className="mt-4 pr-1">
              {floatingPanelTab === "highlights" ? (
                isReadable ? (
                  <ReaderHighlightsPanel
                    actionError={documentHighlights.actionError}
                    focusedHighlightId={documentHighlights.focusedHighlightId}
                    highlights={documentHighlights.highlights}
                    isLoading={documentHighlights.isLoading}
                    onDelete={documentHighlights.removeHighlightById}
                    onFocusedHighlightHandled={documentHighlights.clearFocusedHighlight}
                    onSaveNote={documentHighlights.saveHighlightNote}
                    savingNoteId={documentHighlights.savingNoteId}
                  />
                ) : (
                  <p className="text-sm leading-7 text-[color:var(--text-secondary)]">当前文档暂无可编辑高亮。</p>
                )
              ) : null}

              {floatingPanelTab === "actions" ? (
                <div className="space-y-4">
                  <FavoriteToggleButton
                    buttonLabel={favorite.buttonLabel}
                    className="w-full justify-center"
                    isFavorite={favorite.isFavorite}
                    isSubmitting={favorite.isSubmitting}
                    onClick={favorite.toggleFavorite}
                  />
                  {isReadable ? (
                    <div className="space-y-4">
                      <HighlightSaveModeToggle
                        onChange={persistHighlightSaveMode}
                        value={highlightSaveMode}
                      />
                      <ReaderTypographyControl
                        fontSize={readerFontSize}
                        lineHeight={readerLineHeight}
                        onFontSizeChange={persistReaderFontSize}
                        onLineHeightChange={persistReaderLineHeight}
                      />
                    </div>
                  ) : null}
                  <div className="flex flex-col gap-2">
                    <div className="space-y-2 rounded-[18px] border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface-soft)] p-3">
                      <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[color:var(--text-tertiary)]">
                        下载
                      </p>
                      <div className="flex flex-col gap-2">
                        <a
                          className="inline-flex min-h-10 items-center rounded-[18px] border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface-strong)] px-4 text-sm font-medium text-[color:var(--text-primary)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--button-secondary-hover-bg)]"
                          href={markdownDownloadHref}
                        >
                          下载 Markdown
                        </a>
                        <a
                          className="inline-flex min-h-10 items-center rounded-[18px] border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface-strong)] px-4 text-sm font-medium text-[color:var(--text-primary)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--button-secondary-hover-bg)]"
                          href={htmlDownloadHref}
                        >
                          下载 HTML
                        </a>
                      </div>
                    </div>
                    {sourceUrl ? (
                      <Link
                        className="inline-flex min-h-10 items-center rounded-[18px] border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface-strong)] px-4 text-sm font-medium text-[color:var(--text-primary)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--button-secondary-hover-bg)]"
                        href={sourceUrl}
                        target="_blank"
                      >
                        打开原文
                      </Link>
                    ) : null}
                    <Link
                      className="inline-flex min-h-10 items-center rounded-[18px] border border-transparent px-1 text-sm font-medium text-[color:var(--text-secondary)] transition hover:text-[color:var(--text-primary)]"
                      href="/reading"
                    >
                      返回 Reading
                    </Link>
                  </div>
                  {favorite.actionError ? (
                    <p className="text-sm leading-6 text-[color:var(--badge-danger-text)]">{favorite.actionError}</p>
                  ) : null}
                </div>
              ) : null}

              {floatingPanelTab === "meta" ? (
                <div className="space-y-4">
                  <dl className="space-y-3 text-sm">
                    <MetaRow label="状态" value={formatIngestionStatus(readerDocument.ingestionStatus)} />
                    <MetaRow
                      label={resolveDocumentDateMetaLabel(readerDocument.publishedAt, readerDocument.createdAt)}
                      value={formatPublishedAtLabel(
                        readerDocument.publishedAt,
                        readerDocument.publishedAtKind,
                        readerDocument.createdAt,
                      )}
                    />
                    {documentAttribution ? <MetaRow label={documentAttribution.label} value={documentAttribution.value} /> : null}
                    {readerDocument.lang ? <MetaRow label="语言" value={readerDocument.lang} /> : null}
                    {isReadable && readerDocument.content?.wordCount ? (
                      <MetaRow label="字数" value={formatWordCount(readerDocument.content.wordCount)} />
                    ) : null}
                    {sourceUrl ? <MetaRow label="来源" value={truncateUrl(sourceUrl)} /> : null}
                  </dl>

                  {readerDocument.tags.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[color:var(--text-tertiary)]">标签</p>
                      <DocumentTagPills basePath="/reading" tags={readerDocument.tags} />
                    </div>
                  ) : null}

                  {favorite.isFavorite ? (
                    <div className="rounded-[22px] border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface-soft)] p-4">
                      <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[color:var(--text-tertiary)]">
                        收藏
                      </p>
                      <p className="mt-3 text-sm leading-6 text-[color:var(--text-secondary)]">
                        这篇内容会保留在收藏视图里，方便你之后更快回到它。
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
        </Panel>
      </div>

      {selectionState ? (
        <ReaderSelectionActions
          actionsRef={selectionActionsRef}
          anchor={selectionState.anchor}
          isSaving={documentHighlights.isCreating}
          onHighlight={() => void handleCreateHighlight()}
          onNote={() => void handleCreateHighlightNote()}
          variant={selectionState.trigger === "contextmenu" ? "contextmenu" : "floating"}
        />
      ) : null}

      {autoHighlightFeedback ? (
        <ReaderAutoHighlightFeedback
          anchor={autoHighlightFeedback.anchor}
          onNote={handleAutoHighlightNote}
        />
      ) : null}
    </section>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-4">
      <dt className="text-[color:var(--text-tertiary)]">{label}</dt>
      <dd className="min-w-0 text-right text-[color:var(--text-primary)]">
        <span className="block truncate" title={value}>
          {value}
        </span>
      </dd>
    </div>
  );
}

function ReaderReadCompletionFooter(props: {
  phase: DocumentReadCompletionPhase;
  sentinelRef: RefObject<HTMLDivElement | null>;
}) {
  const isArmed = props.phase === "armed";
  const isActive = props.phase === "animating" || props.phase === "saving";
  const isCompleted = props.phase === "completed";

  return (
    <div
      className={cx(
        "reader-read-completion pointer-events-none relative mt-4 flex min-h-[9.5rem] items-end justify-center px-3 pb-4 sm:px-4",
        isArmed ? "is-armed" : undefined,
        isActive ? "is-active" : undefined,
        isCompleted ? "is-completed" : undefined,
      )}
      data-read-completion
      data-read-completion-state={props.phase}
      ref={props.sentinelRef}
    >
      <div className="reader-read-completion-shell relative flex w-full max-w-[36rem] items-center justify-center overflow-hidden rounded-[28px] px-6 py-7 sm:px-8">
        <span aria-hidden="true" className="reader-read-completion-glow" />
        <span aria-hidden="true" className="reader-read-completion-line" />
        <div className="reader-read-completion-copy relative z-[1] flex flex-col items-center text-center">
          <span className="reader-read-completion-prompt text-[11px] font-medium uppercase tracking-[0.22em] text-[color:var(--text-tertiary)]">
            继续下拉，完成阅读
          </span>
          <span className="reader-read-completion-label font-ui-heading text-[1.2rem] tracking-[-0.03em] text-[color:var(--text-primary)] sm:text-[1.35rem]">
            已读完
          </span>
          <span className="reader-read-completion-subtitle text-[12px] text-[color:var(--text-secondary)]">
            已收入已读归档
          </span>
        </div>
      </div>
    </div>
  );
}

function resolveDocumentAttribution(document: DocumentDetail) {
  if (document.contentOrigin?.label) {
    return {
      label: "公众号",
      value: document.contentOrigin.label,
    };
  }

  if (document.author) {
    return {
      label: "作者",
      value: document.author,
    };
  }

  return null;
}

function formatIngestionStatus(status: IngestionStatus) {
  switch (status) {
    case IngestionStatus.FAILED:
      return "抓取失败";
    case IngestionStatus.READY:
      return "可阅读";
    case IngestionStatus.PROCESSING:
      return "处理中";
    case IngestionStatus.PENDING:
    default:
      return "排队中";
  }
}

function statusTone(status: IngestionStatus) {
  switch (status) {
    case IngestionStatus.FAILED:
      return "danger";
    case IngestionStatus.PROCESSING:
      return "warning";
    case IngestionStatus.PENDING:
      return "subtle";
    case IngestionStatus.READY:
    default:
      return "neutral";
  }
}

function formatDocumentType(value: string) {
  switch (value) {
    case "WEB_PAGE":
      return "Web";
    case "RSS_ITEM":
      return "RSS";
    case "PDF":
      return "PDF";
    default:
      return value;
  }
}

function formatWordCount(value: number) {
  return `${new Intl.NumberFormat("zh-CN").format(value)} 字`;
}

const fontSizeOptions: Array<{ description: string; label: string; value: ReaderFontSizePreference }> = [
  {
    description: "更紧凑，适合信息密度更高的阅读。",
    label: "小",
    value: "small",
  },
  {
    description: "平衡阅读节奏与信息密度。",
    label: "中",
    value: "medium",
  },
  {
    description: "更大字号，长时间阅读更轻松。",
    label: "大",
    value: "large",
  },
];

const lineHeightOptions: Array<{ description: string; label: string; value: ReaderLineHeightPreference }> = [
  {
    description: "行距更紧，滚动更少。",
    label: "紧凑",
    value: "compact",
  },
  {
    description: "默认阅读行距。",
    label: "舒适",
    value: "comfortable",
  },
  {
    description: "更松弛，段落更透气。",
    label: "宽松",
    value: "loose",
  },
];

function ReaderTypographyControl({
  fontSize,
  lineHeight,
  onFontSizeChange,
  onLineHeightChange,
}: {
  fontSize: ReaderFontSizePreference;
  lineHeight: ReaderLineHeightPreference;
  onFontSizeChange: (value: ReaderFontSizePreference) => void;
  onLineHeightChange: (value: ReaderLineHeightPreference) => void;
}) {
  const activeFontSize = fontSizeOptions.find((option) => option.value === fontSize) ?? fontSizeOptions[1];
  const activeLineHeight = lineHeightOptions.find((option) => option.value === lineHeight) ?? lineHeightOptions[1];
  const previewFontSize = resolveReaderFontSizePreferenceValue(fontSize);
  const previewLineHeight = resolveReaderLineHeightPreferenceValue(lineHeight);

  return (
    <div className="space-y-4 rounded-[18px] border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface-soft)] p-4">
      <div className="space-y-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[color:var(--text-tertiary)]">阅读排版</p>
        <p className="text-sm leading-6 text-[color:var(--text-secondary)]">
          字号：{activeFontSize.label} · 行距：{activeLineHeight.label}
        </p>
      </div>

      <div className="space-y-2.5">
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[color:var(--text-tertiary)]">字体大小</p>
        <div className="inline-flex items-center rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] p-1">
          {fontSizeOptions.map((option) => (
            <button
              aria-pressed={fontSize === option.value}
              className={cx(
                "min-h-8 rounded-full px-3 text-xs font-semibold transition",
                fontSize === option.value
                  ? "bg-[color:var(--bg-surface-strong)] text-[color:var(--text-primary)] shadow-[var(--shadow-surface-muted)]"
                  : "text-[color:var(--text-secondary)] hover:bg-[color:var(--button-quiet-hover-bg)] hover:text-[color:var(--text-primary)]",
              )}
              key={option.value}
              onClick={() => onFontSizeChange(option.value)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2.5">
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[color:var(--text-tertiary)]">行距</p>
        <div className="inline-flex items-center rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] p-1">
          {lineHeightOptions.map((option) => (
            <button
              aria-pressed={lineHeight === option.value}
              className={cx(
                "min-h-8 rounded-full px-3 text-xs font-semibold transition",
                lineHeight === option.value
                  ? "bg-[color:var(--bg-surface-strong)] text-[color:var(--text-primary)] shadow-[var(--shadow-surface-muted)]"
                  : "text-[color:var(--text-secondary)] hover:bg-[color:var(--button-quiet-hover-bg)] hover:text-[color:var(--text-primary)]",
              )}
              key={option.value}
              onClick={() => onLineHeightChange(option.value)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2.5">
        <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[color:var(--text-tertiary)]">实时预览</p>
        <div className="rounded-[14px] border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] px-4 py-3.5">
          <p
            className="font-display text-[color:var(--text-primary)]"
            style={{ fontSize: previewFontSize, lineHeight: previewLineHeight }}
          >
            今天的阅读，从一个清晰的段落开始。The interface should stay calm, while the text stays legible and focused.
            <br />
            <br />
            短句用来确认节奏。Longer sentences help you feel how spacing affects sustained reading comfort over time.
          </p>
        </div>
      </div>
    </div>
  );
}

function FloatingTabButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      aria-selected={active}
      className={cx(
        "inline-flex min-h-8 items-center rounded-full border px-3 text-xs font-semibold transition",
        active
          ? "border-[color:var(--border-strong)] bg-[color:var(--bg-surface-strong)] text-[color:var(--text-primary)]"
          : "border-transparent bg-transparent text-[color:var(--text-secondary)] hover:bg-[color:var(--button-quiet-hover-bg)] hover:text-[color:var(--text-primary)]",
      )}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function LayersIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
      viewBox="0 0 20 20"
    >
      <path d="m10 3.2 7 3.6-7 3.6-7-3.6Z" />
      <path d="m3 10.3 7 3.6 7-3.6" />
      <path d="m3 13.6 7 3.6 7-3.6" />
    </svg>
  );
}

function truncateUrl(value: string) {
  try {
    const url = new URL(value);
    return `${url.hostname}${url.pathname}`.replace(/\/$/, "");
  } catch {
    return value;
  }
}
