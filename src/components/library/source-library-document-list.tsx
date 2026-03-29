"use client";

import Link from "next/link";
import { IngestionStatus, type DocumentType } from "@prisma/client";
import { FavoriteToggleButton, useDocumentFavoriteController } from "@/components/documents/favorite-control";
import { Badge } from "@/components/ui/badge";
import { resolveSourceLibraryPreviewText } from "@/lib/documents/source-library";
import type { DocumentListItem } from "@/server/modules/documents/document.types";
import { cx } from "@/utils/cx";
import { getSourceLibraryToneForSeed, type SourceLibraryTone } from "./source-library-source-card";

type SourceLibraryDocumentListProps = {
  items: DocumentListItem[];
  toneSeed?: string;
};

export function SourceLibraryDocumentList({ items, toneSeed }: SourceLibraryDocumentListProps) {
  const tone = getSourceLibraryToneForSeed(toneSeed);

  return (
    <div className="overflow-hidden rounded-[28px] border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface-strong)]">
      <div className="divide-y divide-[color:var(--border-subtle)]">
        {items.map((item) => (
          <SourceLibraryItemCard item={item} key={item.id} tone={tone} />
        ))}
      </div>
    </div>
  );
}

function SourceLibraryItemCard({
  item,
  tone,
}: {
  item: DocumentListItem;
  tone: SourceLibraryTone;
}) {
  const favorite = useDocumentFavoriteController(item);
  const isFailed = item.ingestionStatus === IngestionStatus.FAILED;
  const previewText = resolveSourceLibraryPreviewText(item);
  const shouldShowStatusBadge = item.ingestionStatus !== IngestionStatus.READY;
  const sourcePath = truncateUrl(item.canonicalUrl ?? item.sourceUrl);

  return (
    <article className="px-4 py-4 transition hover:bg-[color:var(--bg-field)] sm:px-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <Link className="block min-w-0 flex-1" href={`/documents/${item.id}`}>
          <div className="grid gap-4 sm:grid-cols-[8.75rem_minmax(0,1fr)] sm:items-start sm:gap-5">
            <SourceLibraryCover item={item} tone={tone} />

            <div className="min-w-0 space-y-4">
              <div className="flex flex-wrap items-center gap-2.5 text-[11px] font-medium uppercase tracking-[0.22em] text-[color:var(--text-tertiary)]">
                <span>{formatDocumentType(item.type)}</span>
                <span>{formatCollectedAt(item.createdAt)}</span>
                {shouldShowStatusBadge ? (
                  <Badge tone={statusTone(item.ingestionStatus)}>{formatIngestionStatus(item.ingestionStatus)}</Badge>
                ) : null}
              </div>

              <div className="space-y-2.5">
                <h4 className="max-w-4xl font-ui-heading text-[1.45rem] leading-[1.1] tracking-[-0.04em] text-[color:var(--text-primary)]">
                  {item.title}
                </h4>
                {previewText ? (
                  <p className="max-w-3xl text-[15px] leading-7 text-[color:var(--text-secondary)]">{previewText}</p>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-[color:var(--text-tertiary)]">
                {sourcePath ? <span className="truncate">{sourcePath}</span> : null}
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

function SourceLibraryCover({
  item,
  tone,
}: {
  item: DocumentListItem;
  tone: SourceLibraryTone;
}) {
  return (
    <div
      className={cx(
        "relative flex h-[11.5rem] w-[8.75rem] min-w-[8.75rem] self-start overflow-hidden rounded-[24px] border p-4",
        tone.cover,
      )}
    >
      <span className="absolute inset-y-4 left-3 w-[3px] rounded-full bg-white/55" />
      <span className={cx("absolute inset-y-4 left-[18px] w-[6px] rounded-full opacity-85", tone.spine)} />

      <div className="relative z-10 flex h-full flex-col justify-between pl-7">
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-black/45">{formatDocumentType(item.type)}</p>
        <p className="line-clamp-6 font-ui-heading text-[0.96rem] leading-[1.16] tracking-[-0.03em] text-black/72">
          {formatSpineTitle(item.title)}
        </p>
      </div>
    </div>
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
    const path = `${url.hostname}${url.pathname}`;
    return path.length > 56 ? `${path.slice(0, 56)}…` : path;
  } catch {
    return value.length > 56 ? `${value.slice(0, 56)}…` : value;
  }
}

function formatSpineTitle(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 36 ? `${normalized.slice(0, 36)}…` : normalized;
}
