"use client";

import Link from "next/link";
import { IngestionStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/ui/panel";
import {
  FavoriteSummaryBadge,
  FavoriteToggleButton,
  useDocumentFavoriteController,
} from "@/components/documents/favorite-control";
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
  const leadText = resolveLeadText(document);
  const showIngestionBadge = document.ingestionStatus !== IngestionStatus.READY;
  const showSummaryBadge = favorite.isFavorite && favorite.summaryState !== "not_favorite";
  const summarySupportText =
    favorite.summaryState === "ready"
      ? "Summary available."
      : favorite.summaryState === "generating"
        ? "Summary generation is still in progress."
        : null;

  return (
    <section className="space-y-10 lg:space-y-12">
      <header className="mx-auto max-w-[var(--content-measure)] space-y-5">
        <div className="flex flex-wrap items-center gap-2.5 text-[11px] font-medium uppercase tracking-[0.22em] text-[color:var(--text-tertiary)]">
          <Link className="transition hover:text-[color:var(--text-primary)]" href="/library">
            Library
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
                    Saved, but not readable yet.
                  </h2>
                  <p className="max-w-2xl text-[15px] leading-7 text-[color:var(--text-secondary)]">
                    The link is stored in your library, but the body could not be captured from the source.
                  </p>
                </div>

                {sourceUrl ? (
                  <div className="space-y-3 rounded-[22px] border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] px-5 py-4">
                    <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[color:var(--text-tertiary)]">
                      Original URL
                    </p>
                    <p className="break-all text-sm leading-7 text-[color:var(--text-secondary)]">{sourceUrl}</p>
                    <Link
                      className="inline-flex min-h-10 items-center rounded-[18px] border border-[color:var(--border-strong)] bg-[color:var(--bg-surface-strong)] px-4 text-sm font-medium text-[color:var(--text-primary)] transition hover:border-[color:var(--text-primary)] hover:bg-white"
                      href={sourceUrl}
                      target="_blank"
                    >
                      Open original
                    </Link>
                  </div>
                ) : null}
              </div>
            ) : contentHtml ? (
              <ReaderRichContent contentHtml={contentHtml} fallbackText={plainText} sourceUrl={sourceUrl} />
            ) : paragraphs.length > 0 ? (
              <div className="reader-prose">
                {paragraphs.map((paragraph, index) => (
                  <p key={`${document.id}-${index}`}>{paragraph}</p>
                ))}
              </div>
            ) : (
              <p className="text-[15px] leading-7 text-[color:var(--text-secondary)]">
                This document is stored, but readable content is not available yet.
              </p>
            )}
          </div>
        </Panel>

        <aside className="lg:pt-2">
          <Panel className="space-y-6 lg:sticky lg:top-24" tone="muted">
            <div className="space-y-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[color:var(--text-tertiary)]">
                Actions
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
                    Open original
                  </Link>
                ) : null}
                <Link
                  className="inline-flex min-h-10 items-center rounded-[18px] border border-transparent px-1 text-sm font-medium text-[color:var(--text-secondary)] transition hover:text-[color:var(--text-primary)]"
                  href="/library"
                >
                  Back to library
                </Link>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[color:var(--text-tertiary)]">
                Document
              </p>
              <dl className="space-y-3 text-sm">
                <MetaRow label="Status" value={formatIngestionStatus(document.ingestionStatus)} />
                <MetaRow label="Added" value={formatDate(document.createdAt)} />
                {document.lang ? <MetaRow label="Language" value={document.lang} /> : null}
                {isReadable && document.content?.wordCount ? (
                  <MetaRow label="Length" value={formatWordCount(document.content.wordCount)} />
                ) : null}
                {sourceUrl ? <MetaRow label="Source" value={truncateUrl(sourceUrl)} /> : null}
              </dl>
            </div>

            {showSummaryBadge || summarySupportText ? (
              <div className="space-y-3 rounded-[22px] border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface-soft)] p-4">
                <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[color:var(--text-tertiary)]">
                  Saved state
                </p>
                {showSummaryBadge ? <FavoriteSummaryBadge state={favorite.summaryState} /> : null}
                {summarySupportText ? (
                  <p className="text-sm leading-6 text-[color:var(--text-secondary)]">{summarySupportText}</p>
                ) : null}
              </div>
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
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}

function formatIngestionStatus(status: IngestionStatus) {
  switch (status) {
    case IngestionStatus.FAILED:
      return "Capture failed";
    case IngestionStatus.READY:
      return "Ready";
    case IngestionStatus.PROCESSING:
      return "Processing";
    case IngestionStatus.PENDING:
    default:
      return "Queued";
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
      return "Web page";
    case "RSS_ITEM":
      return "RSS item";
    case "PDF":
      return "PDF";
    default:
      return value;
  }
}

function formatWordCount(value: number) {
  return `${new Intl.NumberFormat("en").format(value)} words`;
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
