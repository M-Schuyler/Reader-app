"use client";

import Link from "next/link";
import { IngestionStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { FavoriteToggleButton, useDocumentFavoriteController } from "@/components/documents/favorite-control";
import { Panel } from "@/components/ui/panel";
import { formatPublishedAtLabel } from "@/lib/documents/published-at";
import type { GetDocumentsResponseData } from "@/server/modules/documents/document.types";

type DocumentListProps = {
  data: GetDocumentsResponseData;
  emptyState?: {
    eyebrow: string;
    title: string;
    description: string;
  };
};

const DEFAULT_EMPTY_STATE = {
  eyebrow: "Reader",
  title: "这里还没有内容",
  description: "导入一篇文章，库里就会开始形成稳定的阅读流。",
};

export function DocumentList({ data, emptyState = DEFAULT_EMPTY_STATE }: DocumentListProps) {
  if (data.items.length === 0) {
    return (
      <Panel className="px-8 py-10 text-center" tone="muted">
        <div className="mx-auto max-w-md space-y-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[color:var(--text-tertiary)]">
            {emptyState.eyebrow}
          </p>
          <h2 className="font-ui-heading text-[2rem] leading-tight tracking-[-0.04em] text-[color:var(--text-primary)]">
            {emptyState.title}
          </h2>
          <p className="text-sm leading-7 text-[color:var(--text-secondary)]">
            {emptyState.description}
          </p>
        </div>
      </Panel>
    );
  }

  return (
    <Panel className="overflow-hidden" padding="none">
      <div className="divide-y divide-[color:var(--border-subtle)]">
        {data.items.map((item) => (
          <DocumentCard item={item} key={item.id} />
        ))}
      </div>
    </Panel>
  );
}

function DocumentCard({ item }: { item: GetDocumentsResponseData["items"][number] }) {
  const isFailed = item.ingestionStatus === IngestionStatus.FAILED;
  const favorite = useDocumentFavoriteController(item);
  const shouldShowStatusBadge = item.ingestionStatus !== IngestionStatus.READY;
  const previewText = resolvePreviewText(item);

  return (
    <article className="group px-6 py-6 sm:px-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex flex-wrap items-center gap-2.5 text-[11px] font-medium uppercase tracking-[0.22em] text-[color:var(--text-tertiary)]">
            <span>{formatDocumentType(item.type)}</span>
            <span>{formatPublishedAtLabel(item.publishedAt, item.publishedAtKind)}</span>
            {shouldShowStatusBadge ? (
              <Badge tone={statusTone(item.ingestionStatus)}>{formatIngestionStatus(item.ingestionStatus)}</Badge>
            ) : null}
          </div>

          <Link className="block space-y-3" href={`/documents/${item.id}`}>
            <h3 className="max-w-4xl font-ui-heading text-[1.75rem] leading-[1.08] tracking-[-0.04em] text-[color:var(--text-primary)] transition group-hover:text-[color:var(--text-primary-strong)]">
              {item.title}
            </h3>
            {previewText ? <p className="max-w-3xl text-[15px] leading-7 text-[color:var(--text-secondary)]">{previewText}</p> : null}

            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pt-1 text-sm text-[color:var(--text-tertiary)]">
              {!isFailed && item.wordCount ? <span>{formatWordCount(item.wordCount)}</span> : null}
              {item.lang ? <span>{item.lang}</span> : null}
              {item.canonicalUrl ? (
                <span className="truncate">{truncateUrl(item.canonicalUrl)}</span>
              ) : item.sourceUrl ? (
                <span className="truncate">{truncateUrl(item.sourceUrl)}</span>
              ) : null}
            </div>
          </Link>

          {favorite.actionError ? <p className="text-sm text-[color:var(--badge-danger-text)]">{favorite.actionError}</p> : null}
        </div>

        <FavoriteToggleButton
          buttonLabel={favorite.buttonLabel}
          className="shrink-0"
          isFavorite={favorite.isFavorite}
          isSubmitting={favorite.isSubmitting}
          onClick={favorite.toggleFavorite}
        />
      </div>
    </article>
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

function truncateUrl(value: string) {
  try {
    const url = new URL(value);
    return `${url.hostname}${url.pathname === "/" ? "" : url.pathname}`;
  } catch {
    return value;
  }
}

function resolvePreviewText(item: GetDocumentsResponseData["items"][number]) {
  if (item.ingestionStatus === IngestionStatus.FAILED) {
    return null;
  }

  return item.aiSummary ?? item.excerpt;
}
