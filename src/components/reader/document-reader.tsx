"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { IngestionStatus } from "@prisma/client";
import { FavoriteToggleButton, useDocumentFavoriteController } from "@/components/documents/favorite-control";
import { HighlightSaveModeToggle } from "@/components/reader/highlight-save-mode-toggle";
import { ReaderHighlightsPanel, useDocumentHighlights } from "@/components/reader/reader-highlights";
import { ReaderRichContent } from "@/components/reader/reader-rich-content";
import { ReaderAutoHighlightFeedback, ReaderSelectionActions } from "@/components/reader/reader-selection-actions";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/ui/panel";
import { formatPublishedAtLabel } from "@/lib/documents/published-at";
import {
  HIGHLIGHT_SAVE_MODE_STORAGE_KEY,
  normalizeHighlightSaveMode,
  type HighlightSaveMode,
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

export function DocumentReader({ document: readerDocument }: DocumentReaderProps) {
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
  const [autoHighlightFeedback, setAutoHighlightFeedback] = useState<AutoHighlightFeedback | null>(null);
  const [highlightSaveMode, setHighlightSaveMode] = useState<HighlightSaveMode>("manual");
  const [floatingPanelTab, setFloatingPanelTab] = useState<ReaderFloatingPanelTab>("highlights");
  const [isFloatingPanelOpen, setIsFloatingPanelOpen] = useState(false);
  const [headerToggleSlot, setHeaderToggleSlot] = useState<HTMLElement | null>(null);
  const [selectionState, setSelectionState] = useState<ReaderSelectionState | null>(null);
  const documentHighlights = useDocumentHighlights({
    canHighlight: isReadable,
    documentId: readerDocument.id,
  });
  const leadText = resolveLeadText(readerDocument);
  const showIngestionBadge = readerDocument.ingestionStatus !== IngestionStatus.READY;

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    setHighlightSaveMode(normalizeHighlightSaveMode(window.localStorage.getItem(HIGHLIGHT_SAVE_MODE_STORAGE_KEY)));
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
          {leadText ? (
            <p className="max-w-[38rem] text-[1.02rem] leading-8 text-[color:var(--text-secondary)]">{leadText}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-[color:var(--text-tertiary)]">
          <span>{formatPublishedAtLabel(readerDocument.publishedAt, readerDocument.publishedAtKind)}</span>
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
                    链接已保存，但正文暂不可读
                  </h2>
                  <p className="max-w-2xl text-[15px] leading-7 text-[color:var(--text-secondary)]">
                    正文抓取没有成功，但这篇内容仍然保留在你的阅读流里。
                  </p>
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
                    highlights={documentHighlights.highlights}
                    sourceUrl={sourceUrl}
                  />
                </div>

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
                    <HighlightSaveModeToggle
                      onChange={persistHighlightSaveMode}
                      value={highlightSaveMode}
                    />
                  ) : null}
                  <div className="flex flex-col gap-2">
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
                    <MetaRow label="发布时间" value={formatPublishedAtLabel(readerDocument.publishedAt, readerDocument.publishedAtKind)} />
                    {readerDocument.lang ? <MetaRow label="语言" value={readerDocument.lang} /> : null}
                    {isReadable && readerDocument.content?.wordCount ? (
                      <MetaRow label="字数" value={formatWordCount(readerDocument.content.wordCount)} />
                    ) : null}
                    {sourceUrl ? <MetaRow label="来源" value={truncateUrl(sourceUrl)} /> : null}
                  </dl>

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

function resolveLeadText(document: DocumentDetail) {
  if (document.ingestionStatus === IngestionStatus.FAILED) {
    return null;
  }

  return document.aiSummary ?? document.excerpt;
}

function truncateUrl(value: string) {
  try {
    const url = new URL(value);
    return `${url.hostname}${url.pathname}`.replace(/\/$/, "");
  } catch {
    return value;
  }
}
