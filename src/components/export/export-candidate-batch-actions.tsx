"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cx } from "@/utils/cx";

export type ExportCandidate = {
  id: string;
  title: string;
  sourceUrl: string | null;
  canonicalUrl: string | null;
  updatedAt: string;
  isFavorite: boolean;
  hasSummary: boolean;
  highlightCount: number;
};

type BatchDownloadFormat = "obsidian" | "markdown" | "html";

const batchDownloadFormatOptions: Array<{ label: string; value: BatchDownloadFormat }> = [
  { label: "Obsidian", value: "obsidian" },
  { label: "Markdown", value: "markdown" },
  { label: "HTML", value: "html" },
];

export function ExportCandidateBatchActions({ candidates }: { candidates: ExportCandidate[] }) {
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>(() => candidates.map((candidate) => candidate.id));
  const [format, setFormat] = useState<BatchDownloadFormat>("obsidian");
  const [isDownloading, setIsDownloading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const selectedDocumentIdSet = useMemo(() => new Set(selectedDocumentIds), [selectedDocumentIds]);
  const selectedCount = selectedDocumentIds.length;
  const canDownload = selectedCount > 0 && !isDownloading;

  function handleSelectAll() {
    setSelectedDocumentIds(candidates.map((candidate) => candidate.id));
  }

  function handleClearSelection() {
    setSelectedDocumentIds([]);
  }

  function handleToggleDocumentSelection(documentId: string, checked: boolean) {
    setSelectedDocumentIds((current) => {
      if (checked) {
        if (current.includes(documentId)) {
          return current;
        }

        return [...current, documentId];
      }

      return current.filter((id) => id !== documentId);
    });
  }

  async function handleBatchDownload() {
    if (!canDownload) {
      return;
    }

    setIsDownloading(true);
    setActionError(null);

    try {
      const response = await fetch("/api/export/batch-download", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          documentIds: selectedDocumentIds,
          format,
        }),
      });

      if (!response.ok) {
        let message = "批量导出失败，请稍后再试。";

        try {
          const payload = (await response.json()) as {
            ok?: boolean;
            error?: {
              message?: string;
            };
          };

          if (payload.ok === false && payload.error?.message) {
            message = payload.error.message;
          }
        } catch {
          // Ignore JSON parsing failure and keep the default error message.
        }

        setActionError(message);
        return;
      }

      const fileName = resolveDownloadFileName(response.headers.get("Content-Disposition"), format);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = objectUrl;
      anchor.download = fileName;
      anchor.style.display = "none";

      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
    } catch {
      setActionError("批量导出失败，请稍后再试。");
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="text-xs font-medium text-[color:var(--text-secondary)]">
          已选 {selectedCount} / {candidates.length}
        </span>
        <button
          className="text-xs font-medium text-[color:var(--text-secondary)] transition hover:text-[color:var(--text-primary)]"
          onClick={handleSelectAll}
          type="button"
        >
          全选
        </button>
        <button
          className="text-xs font-medium text-[color:var(--text-secondary)] transition hover:text-[color:var(--text-primary)]"
          onClick={handleClearSelection}
          type="button"
        >
          清空
        </button>
        <div className="ml-auto flex items-center gap-2">
          <label className="text-xs font-medium text-[color:var(--text-secondary)]" htmlFor="batch-export-format">
            格式
          </label>
          <select
            className="min-h-9 rounded-[14px] border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] px-2.5 text-sm text-[color:var(--text-primary)]"
            disabled={isDownloading}
            id="batch-export-format"
            onChange={(event) => setFormat(event.target.value as BatchDownloadFormat)}
            value={format}
          >
            {batchDownloadFormatOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <Button disabled={!canDownload} onClick={() => void handleBatchDownload()} variant="primary">
            {isDownloading ? "导出中…" : `批量导出（${selectedCount}）`}
          </Button>
        </div>
      </div>

      {actionError ? (
        <p className="text-sm leading-6 text-[color:var(--badge-danger-text)]">{actionError}</p>
      ) : null}

      <div className="divide-y divide-[color:var(--border-subtle)]">
        {candidates.map((candidate) => (
          <article className="space-y-3 py-5 first:pt-0 last:pb-0" key={candidate.id}>
            <div className="flex items-start gap-3">
              <input
                checked={selectedDocumentIdSet.has(candidate.id)}
                className="mt-1 h-4 w-4 rounded border border-[color:var(--border-strong)] bg-[color:var(--bg-surface)] accent-[color:var(--button-primary-bg)]"
                onChange={(event) => handleToggleDocumentSelection(candidate.id, event.target.checked)}
                type="checkbox"
              />
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex flex-wrap gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-[color:var(--text-tertiary)]">
                  {candidate.hasSummary ? <span>摘要已就绪</span> : null}
                  {candidate.isFavorite ? <span>已收藏</span> : null}
                  {candidate.highlightCount > 0 ? <span>{candidate.highlightCount} 条高亮</span> : null}
                </div>
                <Link
                  className="block font-ui-heading text-[1.6rem] leading-tight tracking-[-0.04em] text-[color:var(--text-primary)] transition hover:text-[color:var(--text-primary-strong)]"
                  href={`/documents/${candidate.id}`}
                >
                  {candidate.title}
                </Link>
                <p
                  className={cx(
                    "truncate text-sm text-[color:var(--text-secondary)]",
                    selectedDocumentIdSet.has(candidate.id)
                      ? "text-[color:var(--text-secondary)]"
                      : "text-[color:var(--text-tertiary)]",
                  )}
                >
                  {truncateUrl(candidate.canonicalUrl ?? candidate.sourceUrl)}
                </p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function truncateUrl(value: string | null) {
  if (!value) {
    return "暂无来源链接";
  }

  try {
    const url = new URL(value);
    return `${url.hostname}${url.pathname === "/" ? "" : url.pathname}`;
  } catch {
    return value;
  }
}

function resolveDownloadFileName(contentDisposition: string | null, format: BatchDownloadFormat) {
  if (contentDisposition) {
    const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) {
      return decodeURIComponent(utf8Match[1]);
    }

    const fallbackMatch = contentDisposition.match(/filename="([^"]+)"/i);
    if (fallbackMatch?.[1]) {
      return fallbackMatch[1];
    }
  }

  const timestamp = new Date().toISOString().replaceAll(":", "").replaceAll("-", "").slice(0, 15);
  return `reader-batch-export-${format}-${timestamp}.zip`;
}
