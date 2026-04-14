"use client";

import { useEffect, useRef, useState, type RefObject, type CSSProperties } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { IngestionStatus } from "@prisma/client";
import { useDocumentFavoriteController } from "@/components/documents/favorite-control";
import { useDocumentHighlights } from "@/components/reader/reader-highlights";
import { ReaderRichContent } from "@/components/reader/reader-rich-content";
import { ReaderAutoHighlightFeedback, ReaderSelectionActions } from "@/components/reader/reader-selection-actions";
import { useDocumentReadCompletion, type DocumentReadCompletionPhase } from "@/components/reader/use-document-read-completion";
import { VideoReader } from "@/components/reader/video-reader";
import { usePrioritizedDocumentAiSummary } from "@/components/reader/use-prioritized-document-ai-summary";
import { useReaderSelection } from "@/components/reader/reader-selection-controller";
import { useReaderToc, useScrollSpy } from "@/components/reader/use-reader-toc";
import { ReaderTableOfContents } from "@/components/reader/reader-toc";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/ui/panel";
import { resolveDocumentLead } from "@/lib/documents/document-lead";
import { resolveDocumentFailedState } from "@/lib/documents/document-failed-state";
import { formatPublishedAtLabel } from "@/lib/documents/published-at";
import { useReaderPreferences } from "@/lib/highlights/preferences.store";
import {
  resolveReaderFontSizePreferenceValue,
  resolveReaderLineHeightPreferenceValue,
} from "@/lib/highlights/preferences";
import type { DocumentDetail, DocumentListItem } from "@/server/modules/documents/document.types";
import { cx } from "@/utils/cx";
import dynamic from "next/dynamic";
import type { ReaderFloatingPanelTab } from "@/components/reader/reader-floating-panel";

const ReaderFloatingPanel = dynamic(
  () => import("@/components/reader/reader-floating-panel").then((mod) => mod.ReaderFloatingPanel),
  { ssr: false }
);

type DocumentReaderProps = {
  document: DocumentDetail;
  nextUp?: DocumentListItem | null;
};

export function DocumentReader({ document: initialDocument, nextUp }: DocumentReaderProps) {
  const readerDocument = usePrioritizedDocumentAiSummary(initialDocument);
  const floatingPanelButtonRef = useRef<HTMLButtonElement>(null);
  const floatingPanelRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  
  const sourceUrl = readerDocument.sourceUrl ?? readerDocument.canonicalUrl;
  const contentHtml = readerDocument.content?.contentHtml?.trim() ?? null;
  const plainText = readerDocument.content?.plainText ?? "";
  const hasExtractedContent = Boolean(contentHtml || plainText.trim());
  const isFailed = readerDocument.ingestionStatus === IngestionStatus.FAILED;
  const videoEmbed = readerDocument.videoEmbed;
  const isVideoMode = Boolean(videoEmbed);
  const isReadable = isVideoMode || (!isFailed && hasExtractedContent);
  const canHighlight = isReadable && !isVideoMode;
  
  const favorite = useDocumentFavoriteController(readerDocument);
  const readCompletion = useDocumentReadCompletion({
    documentId: readerDocument.id,
    isEnabled: canHighlight,
    readState: readerDocument.readState,
  });

  const readerFontSize = useReaderPreferences((state) => state.readerFontSize);
  const readerLineHeight = useReaderPreferences((state) => state.readerLineHeight);

  const toc = useReaderToc(contentHtml ?? "");
  const activeHeaderId = useScrollSpy(toc);

  const [floatingPanelTab, setFloatingPanelTab] = useState<ReaderFloatingPanelTab>(
    isVideoMode ? "actions" : (toc.length > 1 ? "contents" : "highlights")
  );

  useEffect(() => {
    if (toc.length > 1 && floatingPanelTab === "highlights" && !isVideoMode) {
      setFloatingPanelTab("contents");
    }
  }, [toc.length, isVideoMode]); // Set default tab to contents if TOC is available

  const [isFloatingPanelOpen, setIsFloatingPanelOpen] = useState(false);

  const documentHighlights = useDocumentHighlights({
    canHighlight,
    documentId: readerDocument.id,
  });

  const {
    selectionState,
    autoHighlightFeedback,
    selectionActionsRef,
    clearSelection,
    clearAutoHighlightFeedback,
    handleSelectionCapture,
    handleSelectionMouseDown,
    handleSelectionContextMenu,
    handleSelectionMouseUp,
    handleCreateHighlight,
    handleCreateHighlightNote,
    handleAutoHighlightNote,
  } = useReaderSelection({
    canHighlight,
    documentHighlights,
    onFloatingPanelOpen: () => {
      setFloatingPanelTab("highlights");
      setIsFloatingPanelOpen(true);
    },
  });

  const lead = resolveDocumentLead(readerDocument);
  const failedState = resolveDocumentFailedState(readerDocument.ingestion?.error);
  const showIngestionBadge = readerDocument.ingestionStatus !== IngestionStatus.READY;
  const documentAttribution = resolveDocumentAttribution(readerDocument);

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
    if (!canHighlight && floatingPanelTab === "highlights") {
      setFloatingPanelTab("actions");
    }
  }, [canHighlight, floatingPanelTab]);

  useEffect(() => {
    if (!documentHighlights.focusedHighlightId) {
      return;
    }

    if (!canHighlight) {
      return;
    }

    setFloatingPanelTab("highlights");
    setIsFloatingPanelOpen(true);
  }, [canHighlight, documentHighlights.focusedHighlightId]);

  function toggleFloatingPanel() {
    setIsFloatingPanelOpen((current) => !current);
  }

  function handleHighlightSaveModeChange() {
    clearSelection();
    clearAutoHighlightFeedback();
  }

  useScrollProgressDirect(progressBarRef);

  return (
    <section 
      className="space-y-9 lg:space-y-10"
      style={{
        "--reader-font-size": resolveReaderFontSizePreferenceValue(readerFontSize),
        "--reader-line-height": resolveReaderLineHeightPreferenceValue(readerLineHeight),
      } as CSSProperties}
    >
      <div className="fixed left-0 top-0 z-[100] h-1 w-full bg-black/10 backdrop-blur-sm">
        <div 
          className="relative h-full bg-gradient-to-r from-[color:var(--ai-card-accent)] via-[color:var(--ai-card-accent)] to-[color:var(--ai-card-accent)]" 
          ref={progressBarRef}
          style={{ width: '0%' }}
        >
          <div className="absolute right-0 top-0 h-full w-12 bg-gradient-to-r from-transparent to-white/60 shadow-[0_0_20px_var(--ai-card-accent)]" />
          <div className="absolute -right-1 top-[-2px] h-[8px] w-[8px] rounded-full border border-[color:var(--ai-card-accent)] bg-white shadow-[0_0_15px_#fff,0_0_25px_var(--ai-card-accent)]" />
        </div>
      </div>

      <header className="mx-auto max-w-[var(--content-measure)] space-y-6">
        <div className="flex flex-wrap items-center gap-2 text-[13px] font-medium text-[color:var(--text-tertiary)]">
          <Link className="transition hover:text-[color:var(--text-primary)]" href="/reading">
            Library
          </Link>
          <span>·</span>
          <span>{formatDocumentType(readerDocument.type)}</span>
          {showIngestionBadge ? (
            <>
              <span>·</span>
              <Badge tone={statusTone(readerDocument.ingestionStatus)}>{formatIngestionStatus(readerDocument.ingestionStatus)}</Badge>
            </>
          ) : null}
        </div>

        <div className="space-y-4">
          <h1 className="font-display text-[2.5rem] leading-[1.1] tracking-[-0.02em] text-[color:var(--text-primary)] sm:text-[3.5rem]">
            {readerDocument.title}
          </h1>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-[15px] text-[color:var(--text-tertiary)]">
            {documentAttribution ? (
              <>
                <span className="font-medium text-[color:var(--text-secondary)]">{documentAttribution.value}</span>
                <span>·</span>
              </>
            ) : null}
            <span>{formatPublishedAtLabel(readerDocument.publishedAt, readerDocument.publishedAtKind, readerDocument.createdAt)}</span>
            {isReadable && readerDocument.content?.wordCount ? (
               <>
                 <span>·</span>
                 <span>{formatWordCount(readerDocument.content.wordCount)}</span>
               </>
            ) : null}
            {readerDocument.lang ? (
               <>
                 <span>·</span>
                 <span>{readerDocument.lang}</span>
               </>
            ) : null}
          </div>
        </div>
      </header>

      {readerDocument.aiSummaryStatus === "PENDING" ? (
        <div className="mx-auto max-w-[var(--content-measure)]">
          <div className="space-y-4 rounded-2xl border border-[color:var(--ai-card-border)] bg-[color:var(--ai-card-bg)] px-6 py-5">
            <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-[color:var(--ai-card-accent)]">
              <div className="animate-ai-sparkle">
                <SparklesIcon />
              </div>
              <span>AI is thinking...</span>
            </div>
            <div className="space-y-3 pt-1">
              <div className="animate-ai-shimmer h-3 w-[94%] rounded-full bg-[color:var(--ai-card-border)] opacity-30" />
              <div className="animate-ai-shimmer h-3 w-[88%] rounded-full bg-[color:var(--ai-card-border)] opacity-25" style={{ animationDelay: '0.2s' }} />
              <div className="animate-ai-shimmer h-3 w-[65%] rounded-full bg-[color:var(--ai-card-border)] opacity-20" style={{ animationDelay: '0.4s' }} />
            </div>
          </div>
        </div>
      ) : readerDocument.aiSummary ? (
        <div className="mx-auto max-w-[var(--content-measure)] animate-ai-summary-in">
          <div className="relative space-y-2.5 overflow-hidden rounded-2xl border border-[color:var(--ai-card-border)] bg-[color:var(--ai-card-bg)] px-6 py-5 shadow-[var(--shadow-surface-muted)]">
            <div className="absolute left-0 top-0 h-full w-1 bg-[color:var(--ai-card-accent)] opacity-40" />
            <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-[color:var(--ai-card-accent)]">
              <SparklesIcon />
              <span>AI Summary</span>
            </div>
            <p className="text-[15px] leading-relaxed text-[color:var(--text-primary)] opacity-90">
              {readerDocument.aiSummary}
            </p>
          </div>
        </div>
      ) : null}

      <div className="relative mx-auto max-w-[var(--content-measure)]">
        <aside className="absolute -left-[18rem] bottom-0 top-0 hidden w-64 xl:block">
          <div className="sticky top-24">
            <ReaderTableOfContents activeId={activeHeaderId} toc={toc} />
          </div>
        </aside>

        <Panel
          className="overflow-hidden border-[color:var(--border-subtle)] bg-[color:var(--bg-surface-strong)] shadow-[var(--shadow-surface-muted)]"
          padding="none"
          tone="transparent"
        >
          <div className="px-7 py-9 sm:px-11 sm:py-11">
            {videoEmbed ? (
              <div className="space-y-5">
                {isFailed ? (
                  <div className="space-y-2 rounded-[20px] border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface-soft)] px-4 py-3">
                    <p className="text-sm font-medium text-[color:var(--text-primary)]">{failedState.title}</p>
                    <p className="text-sm leading-7 text-[color:var(--text-secondary)]">{failedState.description}</p>
                    <p className="text-sm leading-7 text-[color:var(--text-tertiary)]">{failedState.nextStep}</p>
                  </div>
                ) : null}
                <VideoReader
                  documentId={readerDocument.id}
                  readState={readerDocument.readState}
                  sourceUrl={sourceUrl}
                  title={readerDocument.title}
                  videoDurationSeconds={readerDocument.videoDurationSeconds}
                  videoEmbed={videoEmbed}
                />
              </div>
            ) : isFailed ? (
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
                    highlights={documentHighlights.highlights}
                    sourceUrl={sourceUrl}
                    tocItems={toc}
                  />
                </div>

                <div className="mx-auto my-12 h-px w-24 bg-[color:var(--border-subtle)] opacity-60" />

                <div className="relative min-h-[20vh]">
                  {readCompletion.isVisible ? (
                    <div className={cx(
                      "transition-all duration-700",
                      readCompletion.phase === "completed" ? "scale-95 opacity-0 translate-y-4 pointer-events-none" : "opacity-100 translate-y-0"
                    )}>
                      <ReaderReadCompletionFooter phase={readCompletion.phase} sentinelRef={readCompletion.sentinelRef} />
                    </div>
                  ) : null}

                  {nextUp && (readerDocument.readState === "READ" || readCompletion.phase === "completed") ? (
                    <div className={cx(
                      "animate-next-up-in",
                      readCompletion.phase === "completed" ? "mt-[-9.5rem]" : "mt-0"
                    )}>
                      <ReaderNextUpCard document={nextUp} />
                    </div>
                  ) : null}
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

      <button
        aria-expanded={isFloatingPanelOpen}
        aria-label="打开阅读浮动面板"
        className={cx(
          "fixed right-6 top-6 z-[60] inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface-strong)] text-[color:var(--text-primary)] shadow-[var(--shadow-surface)] transition-all hover:border-[color:var(--border-strong)] hover:bg-[color:var(--button-quiet-hover-bg)] sm:h-11 sm:w-11",
          isFloatingPanelOpen ? "ring-2 ring-[color:var(--ai-card-accent)]" : undefined,
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
      </button>

      <div
        className={cx(
          "fixed right-6 top-[72px] z-50 w-[min(92vw,360px)] origin-top-right transition-all duration-200",
          isFloatingPanelOpen
            ? "pointer-events-auto translate-y-0 scale-100 opacity-100"
            : "pointer-events-none -translate-y-2 scale-[0.98] opacity-0",
        )}
        ref={floatingPanelRef}
      >
        <ReaderFloatingPanel
          activeTab={floatingPanelTab}
          activeHeaderId={activeHeaderId}
          canHighlight={canHighlight}
          document={readerDocument}
          documentHighlights={documentHighlights}
          favorite={favorite}
          isReadable={isReadable}
          onHighlightSaveModeChange={handleHighlightSaveModeChange}
          onTabChange={setFloatingPanelTab}
          sourceUrl={sourceUrl}
          toc={toc}
        />
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

function ReaderNextUpCard({ document: item }: { document: DocumentListItem }) {
  return (
    <div className="mx-auto mt-4 max-w-[var(--content-measure)] pb-12">
      <div className="space-y-8">
        <div className="flex items-center gap-4 text-[11px] font-medium uppercase tracking-[0.24em] text-[color:var(--text-tertiary)]">
          <div className="h-px flex-1 bg-[color:var(--border-subtle)]" />
          <span>Next Up</span>
          <div className="h-px flex-1 bg-[color:var(--border-subtle)]" />
        </div>

        <Link
          className="group block space-y-5 rounded-[32px] border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface-soft)] p-8 transition-all hover:border-[color:var(--border-strong)] hover:bg-[color:var(--bg-surface-strong)] hover:shadow-[var(--shadow-surface)]"
          href={`/documents/${item.id}`}
        >
          <div className="space-y-3.5">
            <h2 className="font-display text-[1.85rem] leading-tight tracking-[-0.025em] text-[color:var(--text-primary)] transition-colors group-hover:text-[color:var(--text-primary-strong)]">
              {item.title}
            </h2>
            {item.aiSummary ? (
              <p className="line-clamp-3 text-[15px] leading-relaxed text-[color:var(--text-secondary)] opacity-85">
                {item.aiSummary}
              </p>
            ) : item.excerpt ? (
              <p className="line-clamp-3 text-[15px] leading-relaxed text-[color:var(--text-secondary)] opacity-85">
                {item.excerpt}
              </p>
            ) : null}
          </div>

          <div className="flex items-center justify-between border-t border-[color:var(--border-subtle)] pt-5">
            <div className="flex items-center gap-2.5 text-[13px] text-[color:var(--text-tertiary)]">
              {item.author ? (
                <>
                  <span className="font-medium text-[color:var(--text-secondary)]">{item.author}</span>
                  <span>·</span>
                </>
              ) : null}
              <span>{formatPublishedAtLabel(item.publishedAt, item.publishedAtKind, item.createdAt)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm font-semibold text-[color:var(--text-primary)] opacity-0 transition-all translate-x-2 group-hover:opacity-100 group-hover:translate-x-0">
              <span>继续阅读</span>
              <ArrowRightIcon />
            </div>
          </div>
        </Link>
      </div>
    </div>
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

function SparklesIcon() {
  return (
    <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24">
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
      <path d="M20 3v4" />
      <path d="M22 5h-4" />
      <path d="M4 17v2" />
      <path d="M5 18H3" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

function useScrollProgressDirect(ref: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    function handleScroll() {
      if (!ref.current) return;
      
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollHeight <= 0) {
        ref.current.style.width = '0%';
        return;
      }
      
      const currentProgress = (window.scrollY / scrollHeight) * 100;
      ref.current.style.width = `${Math.min(100, Math.max(0, currentProgress))}%`;
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [ref]);
}
