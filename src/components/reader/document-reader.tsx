"use client";

import Link from "next/link";
import { IngestionStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { FavoriteToggleButton, useDocumentFavoriteController } from "@/components/documents/favorite-control";
import { ReaderHighlightsPanel, useDocumentHighlights } from "@/components/reader/reader-highlights";
import { ReaderRichContent } from "@/components/reader/reader-rich-content";
import type { DocumentDetail } from "@/server/modules/documents/document.types";

type DocumentReaderProps = {
  document: DocumentDetail;
};

export function DocumentReader({ document }: DocumentReaderProps) {
  const sourceUrl = document.sourceUrl ?? document.canonicalUrl;
  const contentHtml = document.content?.contentHtml?.trim() ?? null;
  const plainText = document.content?.plainText ?? "";
  const hasExtractedContent = Boolean(contentHtml || plainText.trim());
  const isFailed = document.ingestionStatus === IngestionStatus.FAILED;
  const isReadable = !isFailed && hasExtractedContent;
  const favorite = useDocumentFavoriteController(document);
  const paragraphs = isReadable ? plainText.split(/\n{2,}/).filter((paragraph) => paragraph.trim().length > 0) : [];
  const documentHighlights = useDocumentHighlights({
    canHighlight: isReadable,
    documentId: document.id,
  });
  const leadText = resolveLeadText(document);
  const showIngestionBadge = document.ingestionStatus !== IngestionStatus.READY;

  return (
    <section className="space-y-10 lg:space-y-12">
      <header className="mx-auto max-w-[var(--content-measure)] space-y-5">
        <div className="flex flex-wrap items-center gap-2.5 text-[11px] font-medium uppercase tracking-[0.22em] text-[color:var(--text-tertiary)]">
          <Link className="transition hover:text-[color:var(--text-primary)]" href="/library">
            文档库
          </Link>
          <span>/</span>
          <span>{formatDocumentType(document.type)}</span>
          {showIngestionBadge ? (
            <Badge tone={statusTone(document.ingestionStatus)}>{formatIngestionStatus(document.ingestionStatus)}</Badge>
          ) : null}
        </div>

        <div className="space-y-4">
          <h1 className="font-display text-[2.85rem] leading-[0.98] tracking-[-0.045em] text-[color:var(--text-primary)] sm:text-[4.2rem]">
            {document.title}
          </h1>
          {leadText ? (
            <p className="max-w-[38rem] text-[1.05rem] leading-8 text-[color:var(--text-secondary)]">{leadText}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[color:var(--text-secondary)]">
          <span>{formatDate(document.publishedAt ?? document.createdAt)}</span>
          {document.lang ? <span>{document.lang}</span> : null}
          {isReadable && document.content?.wordCount ? <span>{formatWordCount(document.content.wordCount)}</span> : null}
        </div>
      </header>

      <div className="mx-auto grid max-w-[72rem] gap-8 lg:grid-cols-[minmax(0,var(--content-measure))_17rem] lg:justify-center">
        <Panel className="overflow-hidden" padding="none">
          <div className="px-7 py-8 sm:px-10 sm:py-10">
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
                      className="inline-flex min-h-10 items-center rounded-[18px] border border-[color:var(--border-strong)] bg-[color:var(--bg-surface-strong)] px-4 text-sm font-medium text-[color:var(--text-primary)] transition hover:border-[color:var(--text-primary)] hover:bg-white"
                      href={sourceUrl}
                      target="_blank"
                    >
                      打开原文
                    </Link>
                  </div>
                ) : null}
              </div>
            ) : contentHtml ? (
              <div className="space-y-4">
                <div
                  onKeyUp={documentHighlights.captureSelection}
                  onMouseUp={documentHighlights.captureSelection}
                  onTouchEnd={documentHighlights.captureSelection}
                  ref={documentHighlights.contentRef}
                >
                  <ReaderRichContent
                    contentHtml={contentHtml}
                    fallbackText={plainText}
                    highlights={documentHighlights.highlights}
                    sourceUrl={sourceUrl}
                  />
                </div>
                {documentHighlights.selectionDraft ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] px-4 py-3">
                    <p className="text-sm leading-6 text-[color:var(--text-secondary)]">
                      把这段文字保存为高亮，方便稍后回看。
                    </p>
                    <Button
                      className="shrink-0"
                      disabled={documentHighlights.isCreating}
                      onClick={documentHighlights.createHighlightFromSelection}
                      size="sm"
                      variant="secondary"
                    >
                      {documentHighlights.isCreating ? "保存中…" : "保存高亮"}
                    </Button>
                  </div>
                ) : null}
                {documentHighlights.actionError ? (
                  <p className="text-sm leading-6 text-[color:var(--badge-danger-text)]">{documentHighlights.actionError}</p>
                ) : null}
              </div>
            ) : paragraphs.length > 0 ? (
              <div className="space-y-4">
                <div
                  onKeyUp={documentHighlights.captureSelection}
                  onMouseUp={documentHighlights.captureSelection}
                  onTouchEnd={documentHighlights.captureSelection}
                  ref={documentHighlights.contentRef}
                >
                  <ReaderRichContent
                    contentHtml=""
                    fallbackText={plainText}
                    highlights={documentHighlights.highlights}
                    sourceUrl={sourceUrl}
                  />
                </div>
                {documentHighlights.selectionDraft ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] px-4 py-3">
                    <p className="text-sm leading-6 text-[color:var(--text-secondary)]">
                      把这段文字保存为高亮，方便稍后回看。
                    </p>
                    <Button
                      className="shrink-0"
                      disabled={documentHighlights.isCreating}
                      onClick={documentHighlights.createHighlightFromSelection}
                      size="sm"
                      variant="secondary"
                    >
                      {documentHighlights.isCreating ? "保存中…" : "保存高亮"}
                    </Button>
                  </div>
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

        <aside className="lg:pt-2">
          <Panel className="space-y-6 lg:sticky lg:top-24" tone="muted">
            <div className="space-y-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[color:var(--text-tertiary)]">
                操作
              </p>
              <FavoriteToggleButton
                buttonLabel={favorite.buttonLabel}
                className="w-full justify-center"
                isFavorite={favorite.isFavorite}
                isSubmitting={favorite.isSubmitting}
                onClick={favorite.toggleFavorite}
              />
              <div className="flex flex-col gap-2">
                {sourceUrl ? (
                  <Link
                    className="inline-flex min-h-10 items-center rounded-[18px] border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface-strong)] px-4 text-sm font-medium text-[color:var(--text-primary)] transition hover:border-[color:var(--border-strong)] hover:bg-white"
                    href={sourceUrl}
                    target="_blank"
                  >
                    打开原文
                  </Link>
                ) : null}
                <Link
                  className="inline-flex min-h-10 items-center rounded-[18px] border border-transparent px-1 text-sm font-medium text-[color:var(--text-secondary)] transition hover:text-[color:var(--text-primary)]"
                  href="/library"
                >
                  返回文档库
                </Link>
              </div>
              {favorite.actionError ? (
                <p className="text-sm leading-6 text-[color:var(--badge-danger-text)]">{favorite.actionError}</p>
              ) : null}
            </div>

            <div className="space-y-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[color:var(--text-tertiary)]">
                文档信息
              </p>
              <dl className="space-y-3 text-sm">
                <MetaRow label="状态" value={formatIngestionStatus(document.ingestionStatus)} />
                <MetaRow label="收录时间" value={formatDate(document.createdAt)} />
                {document.lang ? <MetaRow label="语言" value={document.lang} /> : null}
                {isReadable && document.content?.wordCount ? (
                  <MetaRow label="字数" value={formatWordCount(document.content.wordCount)} />
                ) : null}
                {sourceUrl ? <MetaRow label="来源" value={truncateUrl(sourceUrl)} /> : null}
              </dl>
            </div>

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

            {isReadable ? (
              <ReaderHighlightsPanel
                actionError={documentHighlights.actionError}
                highlights={documentHighlights.highlights}
                isLoading={documentHighlights.isLoading}
                onDelete={documentHighlights.removeHighlightById}
                onSaveNote={documentHighlights.saveHighlightNote}
                savingNoteId={documentHighlights.savingNoteId}
              />
            ) : null}
          </Panel>
        </aside>
      </div>
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
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

function resolveLeadText(document: DocumentDetail) {
  if (document.ingestionStatus === IngestionStatus.FAILED) {
    return null;
  }

  return document.aiSummary ?? document.excerpt;
}

function truncateUrl(value: string) {
  try {
    const url = new URL(value);
    return `${url.hostname}${url.pathname === "/" ? "" : url.pathname}`;
  } catch {
    return value;
  }
}
