"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Panel } from "@/components/ui/panel";
import { formatPublishedAtLabel } from "@/lib/documents/published-at";
import type { DocumentListItem, GetDocumentsResponseData } from "@/server/modules/documents/document.types";
import { cx } from "@/utils/cx";

type WechatArchiveCatalogProps = {
  data: GetDocumentsResponseData;
  emptyState: {
    eyebrow: string;
    title: string;
    description: string;
  };
  previousHref: string | null;
  nextHref: string | null;
  activeOrigin: string | null;
};

async function importArchiveIds(ids: string[]): Promise<string[]> {
  const failed: string[] = [];
  for (const id of ids) {
    try {
      const response = await fetch(`/api/documents/${id}/import-from-archive`, { method: "POST" });
      if (!response.ok) {
        failed.push(id);
      }
    } catch {
      failed.push(id);
    }
  }
  return failed;
}

export function WechatArchiveCatalog({
  data,
  emptyState,
  previousHref,
  nextHref,
  activeOrigin,
}: WechatArchiveCatalogProps) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [importingIds, setImportingIds] = useState<string[]>([]);
  const [isBatchImporting, setIsBatchImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSelectionChange(id: string, selected: boolean) {
    setSelectedIds((current) =>
      selected ? (current.includes(id) ? current : [...current, id]) : current.filter((candidate) => candidate !== id),
    );
  }

  async function handleSingleImport(id: string) {
    setImportingIds((current) => (current.includes(id) ? current : [...current, id]));
    setError(null);
    const failed = await importArchiveIds([id]);
    setImportingIds((current) => current.filter((candidate) => candidate !== id));
    if (failed.length > 0) {
      setError("导入失败，请重试。");
    } else {
      setSelectedIds((current) => current.filter((candidate) => candidate !== id));
    }
    startTransition(() => {
      router.refresh();
    });
  }

  async function handleBatchImport() {
    if (selectedIds.length === 0) {
      return;
    }
    setIsBatchImporting(true);
    setError(null);
    const failedIds = await importArchiveIds(selectedIds);
    setSelectedIds(failedIds);
    setIsBatchImporting(false);
    if (failedIds.length > 0) {
      setError(`${failedIds.length} 篇导入失败，请重试。`);
    }
    startTransition(() => {
      router.refresh();
    });
  }

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
          <p className="text-sm leading-7 text-[color:var(--text-secondary)]">{emptyState.description}</p>
        </div>
      </Panel>
    );
  }

  return (
    <div className="space-y-5">
      {/* 信息源分类:点击按公众号筛选目录 */}
      {data.contentOrigin && data.contentOrigin.options.length > 1 ? (
        <div className="flex flex-wrap gap-2">
          <OriginChip active={!activeOrigin} href="/sources/archive" label="全部" total={data.pagination.total} />
          {data.contentOrigin.options.map((option) => (
            <OriginChip
              active={activeOrigin === option.value}
              count={option.count}
              href={`/sources/archive?origin=${encodeURIComponent(option.value)}`}
              key={option.value}
              label={option.label}
            />
          ))}
        </div>
      ) : null}

      {selectedIds.length > 0 ? (
        <Panel className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" tone="muted">
          <p className="text-sm font-medium text-[color:var(--text-primary)]">已选 {selectedIds.length} 篇</p>
          <button
            className="inline-flex min-h-10 items-center rounded-[18px] border border-[color:var(--border-subtle)] px-4 text-sm font-medium text-[color:var(--text-primary)] transition hover:border-[color:var(--border-strong)] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isBatchImporting || isPending}
            onClick={handleBatchImport}
            type="button"
          >
            {isBatchImporting ? "导入中…" : "导入选中"}
          </button>
        </Panel>
      ) : null}

      {error ? <p className="text-sm text-[color:var(--badge-danger-text)]">{error}</p> : null}

      {/* 目录式：默认紧凑单行，悬停才展开摘要详情 */}
      <Panel className="overflow-hidden" padding="none">
        <ul className="divide-y divide-[color:var(--border-subtle)]">
          {data.items.map((item) => (
            <CatalogRow
              importing={importingIds.includes(item.id)}
              item={item}
              key={item.id}
              onImport={handleSingleImport}
              onSelectionChange={handleSelectionChange}
              selected={selectedIds.includes(item.id)}
            />
          ))}
        </ul>
      </Panel>

      {data.pagination.totalPages > 1 ? (
        <div className="flex items-center justify-between px-1 text-sm text-[color:var(--text-tertiary)]">
          {previousHref ? (
            <Link className="transition hover:text-[color:var(--text-primary)]" href={previousHref}>
              ← 上一页
            </Link>
          ) : (
            <span />
          )}
          <span>
            {data.pagination.page} / {data.pagination.totalPages}
          </span>
          {nextHref ? (
            <Link className="transition hover:text-[color:var(--text-primary)]" href={nextHref}>
              下一页 →
            </Link>
          ) : (
            <span />
          )}
        </div>
      ) : null}
    </div>
  );
}

function OriginChip({
  href,
  label,
  active,
  count,
  total,
}: {
  href: string;
  label: string;
  active: boolean;
  count?: number;
  total?: number;
}) {
  const badge = count ?? total;
  return (
    <Link
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition",
        active
          ? "border-[color:var(--text-primary)] bg-[color:var(--bg-surface-strong)] text-[color:var(--text-primary)]"
          : "border-[color:var(--border-subtle)] text-[color:var(--text-secondary)] hover:border-[color:var(--border-strong)] hover:text-[color:var(--text-primary)]",
      )}
      href={href}
    >
      {label}
      {typeof badge === "number" ? <span className={active ? "opacity-70" : "opacity-50"}>{badge}</span> : null}
    </Link>
  );
}

function CatalogRow({
  item,
  selected,
  importing,
  onSelectionChange,
  onImport,
}: {
  item: DocumentListItem;
  selected: boolean;
  importing: boolean;
  onSelectionChange: (id: string, selected: boolean) => void;
  onImport: (id: string) => void;
}) {
  const account = item.contentOrigin?.label ?? item.author ?? "";
  const dateLabel = formatPublishedAtLabel(item.publishedAt, item.publishedAtKind, item.createdAt);

  return (
    <li className="group relative transition-colors hover:bg-[color:var(--bg-surface-soft)]">
      <div className="flex items-center gap-3 px-4 py-2">
        <input
          aria-label={`选择 ${item.title}`}
          checked={selected}
          className="size-4 shrink-0 cursor-pointer accent-[var(--text-primary)]"
          onChange={(event) => onSelectionChange(item.id, event.target.checked)}
          type="checkbox"
        />
        <span className="w-14 shrink-0 text-[11px] tabular-nums text-[color:var(--text-tertiary)]">{dateLabel}</span>
        {account ? (
          <span className="hidden max-w-[7rem] shrink-0 truncate text-[11px] text-[color:var(--text-tertiary)] sm:inline">
            {account}
          </span>
        ) : null}
        <span className="min-w-0 flex-1 truncate text-sm text-[color:var(--text-primary)]">{item.title}</span>
        <button
          className="shrink-0 rounded-[12px] border border-transparent px-2.5 py-1 text-xs font-medium text-[color:var(--text-secondary)] opacity-0 transition focus:opacity-100 group-hover:opacity-100 hover:border-[color:var(--border-strong)] hover:text-[color:var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-40"
          disabled={importing}
          onClick={() => onImport(item.id)}
          type="button"
        >
          {importing ? "导入中…" : "导入"}
        </button>
      </div>

      {/* 悬停展开：摘要详情(卡片态) */}
      {item.excerpt ? (
        <div className="grid grid-rows-[0fr] transition-all duration-200 ease-out group-hover:grid-rows-[1fr]">
          <div className="overflow-hidden">
            <p className="px-4 pb-3 pl-[2.5rem] text-xs leading-6 text-[color:var(--text-secondary)]">
              {item.excerpt}
            </p>
          </div>
        </div>
      ) : null}
    </li>
  );
}
