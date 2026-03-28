"use client";

import Link from "next/link";
import { IngestionStatus, type DocumentType } from "@prisma/client";
import { FavoriteToggleButton, useDocumentFavoriteController } from "@/components/documents/favorite-control";
import { Badge } from "@/components/ui/badge";
import { Panel } from "@/components/ui/panel";
import { buildSourceShelfSections, resolveSourceLibraryPreviewText, type SourceShelfSection } from "@/lib/documents/source-library";
import type { DocumentListItem, GetDocumentsResponseData } from "@/server/modules/documents/document.types";
import { cx } from "@/utils/cx";

type SourceLibraryProps = {
  data: GetDocumentsResponseData;
};

const SOURCE_SPINE_TONES = [
  {
    panel: "border-[#d8c7af]/80 bg-[#efe4d3]",
    spine: "bg-[#b68b5d]",
  },
  {
    panel: "border-[#c7d0d6]/80 bg-[#e4eaee]",
    spine: "bg-[#7f92a0]",
  },
  {
    panel: "border-[#d5cec3]/80 bg-[#eee7dd]",
    spine: "bg-[#9b8064]",
  },
  {
    panel: "border-[#d2d6c7]/80 bg-[#edf0e5]",
    spine: "bg-[#7b8d6a]",
  },
] as const;

export function SourceLibrary({ data }: SourceLibraryProps) {
  const sections = buildSourceShelfSections(data.items);

  if (sections.length === 0) {
    return (
      <Panel className="px-8 py-12 text-center" tone="muted">
        <div className="mx-auto max-w-lg space-y-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[color:var(--text-tertiary)]">
            Source Library
          </p>
          <h2 className="font-ui-heading text-[2.2rem] leading-tight tracking-[-0.04em] text-[color:var(--text-primary)]">
            来源库还没有内容
          </h2>
          <p className="text-sm leading-7 text-[color:var(--text-secondary)]">
            先把网页、RSS 或 PDF 收进来。它们会先安静停在这里，等你决定哪些值得真正开始读。
          </p>
        </div>
      </Panel>
    );
  }

  return (
    <div className="space-y-8">
      {sections.map((section) => (
        <SourceLibraryShelf key={section.key} section={section} />
      ))}
    </div>
  );
}

function SourceLibraryShelf({ section }: { section: SourceShelfSection }) {
  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 border-b border-[color:var(--border-subtle)] pb-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-ui-heading text-[1.45rem] leading-tight tracking-[-0.03em] text-[color:var(--text-primary)]">
              {section.label}
            </h2>
            <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-[color:var(--text-tertiary)]">
              {section.description}
            </span>
          </div>
          <p className="text-sm text-[color:var(--text-secondary)]">
            {section.label === "最近收进来"
              ? "过去 24 小时内新收进来的内容。"
              : section.label === "近七天"
                ? "先把这一周的来源排成一列，方便回看和挑选。"
                : "更早收入库的内容，仍然保留在书架里。"}
          </p>
        </div>

        <p className="text-sm text-[color:var(--text-tertiary)]">
          {section.items.length} 篇
        </p>
      </div>

      <div className="space-y-4">
        {section.items.map((item, index) => (
          <SourceLibraryCard item={item} key={item.id} shelfIndex={index} />
        ))}
      </div>
    </section>
  );
}

function SourceLibraryCard({
  item,
  shelfIndex,
}: {
  item: DocumentListItem;
  shelfIndex: number;
}) {
  const isFailed = item.ingestionStatus === IngestionStatus.FAILED;
  const favorite = useDocumentFavoriteController(item);
  const previewText = resolveSourceLibraryPreviewText(item);
  const tone = SOURCE_SPINE_TONES[shelfIndex % SOURCE_SPINE_TONES.length];
  const shouldShowStatusBadge = item.ingestionStatus !== IngestionStatus.READY;
  const urlLabel = truncateUrl(item.canonicalUrl ?? item.sourceUrl);
  const sourceLabel = item.feed?.title ?? urlLabel;

  return (
    <article className="rounded-[30px] border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface-strong)] px-5 py-5 shadow-[var(--shadow-surface-muted)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--bg-field)] sm:px-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <Link className="block min-w-0 flex-1" href={`/documents/${item.id}`}>
          <div className="grid gap-4 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-5">
            <div
              className={cx(
                "relative hidden min-h-[11rem] overflow-hidden rounded-[24px] border p-4 sm:flex sm:flex-col sm:justify-end",
                tone.panel,
              )}
            >
              <span className="absolute inset-y-4 left-3 w-[3px] rounded-full bg-white/55" />
              <span className={cx("absolute inset-y-4 left-[18px] w-[6px] rounded-full opacity-85", tone.spine)} />
              <div className="relative z-10 space-y-3 pl-6">
                <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-black/45">
                  {formatDocumentType(item.type)}
                </p>
                <p className="font-ui-heading text-lg leading-tight tracking-[-0.03em] text-black/70">
                  {formatSpineTitle(item.title)}
                </p>
              </div>
            </div>

            <div className="min-w-0 space-y-4">
              <div className="flex flex-wrap items-center gap-2.5 text-[11px] font-medium uppercase tracking-[0.22em] text-[color:var(--text-tertiary)]">
                <span>{formatDocumentType(item.type)}</span>
                <span>{formatCollectedAt(item.createdAt)}</span>
                {shouldShowStatusBadge ? (
                  <Badge tone={statusTone(item.ingestionStatus)}>{formatIngestionStatus(item.ingestionStatus)}</Badge>
                ) : null}
              </div>

              <div className="space-y-2.5">
                <h3 className="max-w-4xl font-ui-heading text-[1.6rem] leading-[1.08] tracking-[-0.04em] text-[color:var(--text-primary)]">
                  {item.title}
                </h3>
                {previewText ? (
                  <p className="max-w-3xl text-[15px] leading-7 text-[color:var(--text-secondary)]">{previewText}</p>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-[color:var(--text-tertiary)]">
                {sourceLabel ? <span className="truncate">{sourceLabel}</span> : null}
                {!isFailed && item.wordCount ? <span>{formatWordCount(item.wordCount)}</span> : null}
                {item.lang ? <span>{item.lang}</span> : null}
              </div>
            </div>
          </div>
        </Link>

        <div className="flex shrink-0 flex-col items-start gap-3 lg:items-end">
          <FavoriteToggleButton
            buttonLabel={favorite.buttonLabel}
            className="shrink-0"
            isFavorite={favorite.isFavorite}
            isSubmitting={favorite.isSubmitting}
            onClick={favorite.toggleFavorite}
          />
          {favorite.actionError ? <p className="text-sm text-[color:var(--badge-danger-text)]">{favorite.actionError}</p> : null}
        </div>
      </div>
    </article>
  );
}

function formatDocumentType(value: DocumentType) {
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

function formatCollectedAt(value: string) {
  return `收进来 ${new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
  }).format(new Date(value))}`;
}

function formatWordCount(value: number) {
  return `${new Intl.NumberFormat("zh-CN").format(value)} 字`;
}

function formatIngestionStatus(status: IngestionStatus) {
  switch (status) {
    case IngestionStatus.FAILED:
      return "抓取失败";
    case IngestionStatus.PROCESSING:
      return "处理中";
    case IngestionStatus.PENDING:
      return "排队中";
    case IngestionStatus.READY:
    default:
      return "可阅读";
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

function truncateUrl(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    return `${url.hostname}${url.pathname === "/" ? "" : url.pathname}`;
  } catch {
    return value;
  }
}

function formatSpineTitle(value: string) {
  return value.length > 28 ? `${value.slice(0, 28)}…` : value;
}
