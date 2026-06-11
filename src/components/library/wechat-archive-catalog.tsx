"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { DocumentList } from "@/components/library/document-list";
import { Panel } from "@/components/ui/panel";
import type { GetDocumentsResponseData } from "@/server/modules/documents/document.types";

type WechatArchiveCatalogProps = {
  data: GetDocumentsResponseData;
  emptyState: {
    eyebrow: string;
    title: string;
    description: string;
  };
  previousHref: string | null;
  nextHref: string | null;
};

export function WechatArchiveCatalog({ data, emptyState, previousHref, nextHref }: WechatArchiveCatalogProps) {
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSelectionChange(id: string, selected: boolean) {
    setSelectedIds((current) =>
      selected ? (current.includes(id) ? current : [...current, id]) : current.filter((candidate) => candidate !== id),
    );
  }

  async function handleBatchImport() {
    if (selectedIds.length === 0) {
      return;
    }

    setIsImporting(true);
    setError(null);
    const failedIds: string[] = [];

    for (const id of selectedIds) {
      try {
        const response = await fetch(`/api/documents/${id}/import-from-archive`, { method: "POST" });
        if (!response.ok) {
          failedIds.push(id);
        }
      } catch {
        failedIds.push(id);
      }
    }

    setSelectedIds(failedIds);
    setIsImporting(false);
    if (failedIds.length > 0) {
      setError(`${failedIds.length} 篇导入失败，请重试。`);
    }

    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      {data.items.length > 0 ? (
        <Panel className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" tone="muted">
          <div className="space-y-1">
            <p className="text-sm font-medium text-[color:var(--text-primary)]">已选 {selectedIds.length} 篇</p>
            <p className="text-xs leading-6 text-[color:var(--text-tertiary)]">只会读取选中的本地 Markdown，并逐篇进入摘要队列。</p>
          </div>
          <button
            className="inline-flex min-h-10 items-center rounded-[18px] border border-[color:var(--border-subtle)] px-4 text-sm font-medium text-[color:var(--text-primary)] transition hover:border-[color:var(--border-strong)] disabled:cursor-not-allowed disabled:opacity-50"
            disabled={selectedIds.length === 0 || isImporting || isPending}
            onClick={handleBatchImport}
            type="button"
          >
            {isImporting ? "导入中…" : "导入选中"}
          </button>
        </Panel>
      ) : null}

      {error ? <p className="text-sm text-[color:var(--badge-danger-text)]">{error}</p> : null}

      <DocumentList
        catalogSelection={{ selectedIds, onSelectionChange: handleSelectionChange }}
        data={data}
        emptyState={emptyState}
      />

      {data.pagination.totalPages > 1 ? (
        <div className="flex items-center justify-between px-1 text-sm text-[color:var(--text-tertiary)]">
          {previousHref ? (
            <Link className="transition hover:text-[color:var(--text-primary)]" href={previousHref}>
              ← 上一页
            </Link>
          ) : <span />}
          <span>{data.pagination.page} / {data.pagination.totalPages}</span>
          {nextHref ? (
            <Link className="transition hover:text-[color:var(--text-primary)]" href={nextHref}>
              下一页 →
            </Link>
          ) : <span />}
        </div>
      ) : null}
    </div>
  );
}
