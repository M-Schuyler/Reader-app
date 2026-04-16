"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { IngestionStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { DocumentTagPills } from "@/components/documents/document-tag-pills";
import { FavoriteToggleButton, useDocumentFavoriteController } from "@/components/documents/favorite-control";
import { MagicWandIcon, PremiumStarIcon, NibIcon } from "@/components/icons/magic-wand-icon";
import { Panel } from "@/components/ui/panel";
import { formatPublishedAtLabel } from "@/lib/documents/published-at";
import type { GetDocumentsResponseData, DocumentListItem } from "@/server/modules/documents/document.types";
import { cx } from "@/utils/cx";

type DocumentListProps = {
  data: GetDocumentsResponseData;
  showDelete?: boolean;
  onItemDelete?: () => void;
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

export function DocumentList({ 
  data, 
  emptyState = DEFAULT_EMPTY_STATE,
  showDelete = false,
  onItemDelete,
}: DocumentListProps) {
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
          <DocumentCard 
            item={item} 
            key={item.id} 
            onDelete={onItemDelete}
            showDelete={showDelete} 
          />
        ))}
      </div>
    </Panel>
  );
}

function DocumentCard({ 
  item, 
  showDelete,
  onDelete 
}: { 
  item: DocumentListItem;
  showDelete?: boolean;
  onDelete?: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  
  const isFailed = item.ingestionStatus === IngestionStatus.FAILED;
  const favorite = useDocumentFavoriteController(item);
  const shouldShowStatusBadge = item.ingestionStatus !== IngestionStatus.READY;

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    
    if (!window.confirm("确认删除这篇文章吗？相关高亮也会被移除。")) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const response = await fetch(`/api/documents/${item.id}`, { method: "DELETE" });
      if (response.ok) {
        startTransition(() => {
          router.refresh();
          onDelete?.();
        });
      } else {
        setDeleteError("删除失败");
      }
    } catch {
      setDeleteError("网络错误");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <article className="group relative px-6 py-8 transition-all duration-300 hover:bg-stone-900/[0.02] sm:px-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.28em] text-[color:var(--text-tertiary)]">
            <span className="opacity-40 transition-opacity group-hover:opacity-70">{formatDocumentType(item.type)}</span>
            <span className="opacity-40 transition-opacity group-hover:opacity-70">·</span>
            <span className="opacity-40 transition-opacity group-hover:opacity-70 tabular-nums">{formatPublishedAtLabel(item.publishedAt, item.publishedAtKind, item.createdAt)}</span>
            
            <div className="flex items-center gap-2 ml-1">
              {item.readState === "READ" && (
                <StatusIconTooltip icon={<CheckCircleIcon className="text-emerald-500" />} label="Read" />
              )}
              {item.isFavorite && (
                <StatusIconTooltip icon={<PremiumStarIcon className="text-amber-500" />} label="Favorite" />
              )}
              {shouldShowStatusBadge ? (
                <Badge tone={statusTone(item.ingestionStatus)}>{formatIngestionStatus(item.ingestionStatus)}</Badge>
              ) : null}
            </div>
          </div>

          <Link className="block space-y-3.5" href={`/documents/${item.id}`}>
            <h3 className="max-w-4xl font-ui-heading text-[1.8rem] font-bold leading-[1.1] tracking-[-0.045em] text-[color:var(--text-primary)] transition-colors group-hover:text-[color:var(--text-primary-strong)]">
              {item.title}
            </h3>
            
            {(item.aiSummary || item.excerpt) && (
              <div className={cx(
                "relative max-w-3xl rounded-2xl px-4 py-3 text-[15px] leading-relaxed transition-colors",
                item.aiSummary 
                  ? "bg-[color:var(--ai-card-accent)]/5 text-[color:var(--text-primary)] border-l-2 border-[color:var(--ai-card-accent)]/30" 
                  : "text-[color:var(--text-secondary)] opacity-85"
              )}>
                {item.aiSummary && (
                  <div className="mb-2 flex items-center gap-2">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[color:var(--ai-card-accent)]/15 text-[color:var(--ai-card-accent)]">
                      <MagicWandIcon className="h-3.5 w-3.5" />
                    </div>
                  </div>
                )}
                <p className="line-clamp-3">
                  {item.aiSummary ?? item.excerpt}
                </p>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pt-1 text-[12px] font-medium text-[color:var(--text-tertiary)] transition-colors group-hover:text-[color:var(--text-secondary)]">
              {!isFailed && item.wordCount ? (
                <div className="flex items-center gap-2 rounded-full bg-stone-900/[0.03] px-2 py-0.5 group-hover:bg-stone-900/[0.05]">
                  <span>{formatWordCount(item.wordCount)}</span>
                  <span className="h-1 w-1 rounded-full bg-[color:var(--border-strong)] opacity-30" />
                  <span className="text-[11px] font-bold text-[color:var(--ai-card-accent)]">
                    {formatReadingTime(item.wordCount)}
                  </span>
                </div>
              ) : null}
              
              <div className="flex items-center gap-2 truncate opacity-60">
                <span className="h-3 w-px bg-[color:var(--border-subtle)]" />
                {item.canonicalUrl && (
                  <img
                    alt=""
                    className="h-3.5 w-3.5 rounded-sm grayscale opacity-70 transition-all group-hover:grayscale-0 group-hover:opacity-100"
                    src={`https://www.google.com/s2/favicons?sz=32&domain=${new URL(item.canonicalUrl).hostname}`}
                  />
                )}
                <span className="truncate">{item.author || truncateUrl(item.canonicalUrl ?? item.sourceUrl)}</span>
              </div>
            </div>
          </Link>

          <div className="pt-1 opacity-60 transition-opacity group-hover:opacity-100">
            <DocumentTagPills basePath="/reading" tags={item.tags} />
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end sm:gap-2">
          {item.videoThumbnailUrl && (
            <div className="hidden xl:block pointer-events-none">
              <img
                src={item.videoThumbnailUrl}
                alt=""
                className="h-[60px] w-[100px] rounded-xl object-cover border border-[color:var(--border-subtle)] shadow-sm transition-transform group-hover:scale-105"
              />
            </div>
          )}

          <FavoriteToggleButton
            buttonLabel={favorite.buttonLabel}
            className="relative z-10 opacity-20 transition-opacity group-hover:opacity-100"
            isFavorite={favorite.isFavorite}
            isSubmitting={favorite.isSubmitting}
            onClick={favorite.toggleFavorite}
          />
          
          {showDelete && (
            <button
              className="rounded-full p-2 text-[color:var(--text-tertiary)] opacity-0 transition-all hover:bg-red-50 hover:text-red-600 group-hover:opacity-100"
              onClick={handleDelete}
              title="删除文章"
              disabled={isDeleting || isPending}
            >
              {isDeleting ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <TrashIcon />
              )}
            </button>
          )}
        </div>
      </div>
      
      {favorite.actionError && <p className="mt-2 text-xs text-red-500">{favorite.actionError}</p>}
      {deleteError && <p className="mt-2 text-xs text-red-500">{deleteError}</p>}

      {item.readState !== "UNREAD" && (
        <div className="absolute bottom-0 left-0 h-0.5 w-full bg-stone-900/5">
          <div
            className="h-full bg-[color:var(--ai-card-accent)] transition-all duration-700 ease-out"
            style={{ width: item.readState === "READ" ? "100%" : `${item.readingProgress}%` }}
          />
        </div>
      )}
    </article>
  );
}

function TrashIcon() {
  return (
    <svg aria-hidden="true" className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" viewBox="0 0 24 24">
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={cx("h-4 w-4", className)} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" viewBox="0 0 24 24">
      <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
      <path d="M22 4L12 14.01l-3-3" />
    </svg>
  );
}

function StatusIconTooltip({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="group/status relative flex items-center justify-center">
      <div className="flex h-6 w-6 items-center justify-center transition-transform group-hover/status:scale-110">
        {icon}
      </div>
      <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-[color:var(--text-primary)] px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-white opacity-0 transition-opacity group-hover/status:opacity-100">
        {label}
      </span>
    </div>
  );
}

function formatIngestionStatus(status: IngestionStatus) {
  switch (status) {
    case IngestionStatus.FAILED: return "抓取失败";
    case IngestionStatus.READY: return "可阅读";
    case IngestionStatus.PROCESSING: return "处理中";
    case IngestionStatus.PENDING:
    default: return "排队中";
  }
}

function statusTone(status: IngestionStatus) {
  switch (status) {
    case IngestionStatus.FAILED: return "danger";
    case IngestionStatus.PROCESSING: return "warning";
    case IngestionStatus.PENDING: return "subtle";
    case IngestionStatus.READY:
    default: return "neutral";
  }
}

function formatDocumentType(value: string) {
  switch (value) {
    case "WEB_PAGE": return "Web";
    case "RSS_ITEM": return "RSS";
    case "PDF": return "PDF";
    default: return value;
  }
}

function formatWordCount(value: number) {
  return `${new Intl.NumberFormat("zh-CN").format(value)} 字`;
}

function formatReadingTime(wordCount: number) {
  const wpm = 350; // Average Chinese/English mixed reading speed
  const minutes = Math.max(1, Math.ceil(wordCount / wpm));
  return `约 ${minutes} 分钟`;
}

function truncateUrl(value: string | null) {
  if (!value) return "";
  try {
    const url = new URL(value);
    return `${url.hostname}${url.pathname === "/" ? "" : url.pathname}`;
  } catch {
    return value;
  }
}
