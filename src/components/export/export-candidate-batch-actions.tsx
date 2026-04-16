"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { MagicWandIcon, PremiumStarIcon, NibIcon } from "@/components/icons/magic-wand-icon";
import { cx } from "@/utils/cx";
import { formatPublishedAtLabel } from "@/lib/documents/published-at";

export type ExportCandidate = {
  id: string;
  title: string;
  author?: string | null;
  sourceUrl: string | null;
  canonicalUrl: string | null;
  publishedAt?: string | null;
  publishedAtKind?: any;
  createdAt: string;
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
        if (current.includes(documentId)) return current;
        return [...current, documentId];
      }
      return current.filter((id) => id !== documentId);
    });
  }

  async function handleBatchDownload() {
    if (!canDownload) return;
    setIsDownloading(true);
    setActionError(null);

    try {
      const response = await fetch("/api/export/batch-download", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ documentIds: selectedDocumentIds, format }),
      });

      if (!response.ok) {
        let message = "批量导出失败，请稍后再试。";
        try {
          const payload = (await response.json()) as { ok?: boolean; error?: { message?: string } };
          if (payload.ok === false && payload.error?.message) message = payload.error.message;
        } catch {}
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
    <div className="space-y-10">
      <div className="sticky top-0 z-30 -mx-4 flex flex-wrap items-center justify-between gap-4 bg-[color:var(--bg-body)]/80 px-4 py-6 backdrop-blur-md sm:mx-0 sm:px-0 border-b border-[color:var(--border-subtle)]/50">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-[13px] font-bold tabular-nums text-[color:var(--text-primary)]">
              {selectedCount} <span className="text-[color:var(--text-tertiary)] font-medium">Selected</span>
            </span>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[color:var(--text-tertiary)]">
            <button className="transition hover:text-[color:var(--text-primary)]" onClick={handleSelectAll} type="button">All</button>
            <span className="h-2 w-px bg-[color:var(--border-subtle)]" />
            <button className="transition hover:text-[color:var(--text-primary)]" onClick={handleClearSelection} type="button">None</button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex rounded-full bg-[color:var(--bg-field)] p-1 ring-1 ring-[color:var(--border-subtle)]/50">
            {batchDownloadFormatOptions.map((option) => (
              <button
                className={cx(
                  "min-h-8 rounded-full px-5 text-[10px] font-bold uppercase tracking-wider transition-all",
                  format === option.value
                    ? "bg-[color:var(--bg-surface)] text-[color:var(--text-primary)] shadow-sm ring-1 ring-black/5"
                    : "text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)]",
                )}
                disabled={isDownloading}
                key={option.value}
                onClick={() => setFormat(option.value)}
                type="button"
              >
                {option.label}
              </button>
            ))}
          </div>
          <Button 
            className="rounded-full px-8 py-6 text-[12px] font-bold uppercase tracking-widest shadow-xl shadow-black/5 transition-all active:scale-95 hover:shadow-black/10" 
            disabled={!canDownload} 
            onClick={() => void handleBatchDownload()} 
            variant="primary"
          >
            {isDownloading ? "..." : "Export"}
          </Button>
        </div>
      </div>

      {actionError ? (
        <p className="rounded-2xl bg-[color:var(--badge-danger-bg)] px-4 py-3 text-[13px] text-[color:var(--badge-danger-text)] border border-[color:var(--badge-danger-text)]/10">{actionError}</p>
      ) : null}

      <div className="space-y-6">
        {candidates.map((candidate) => {
          const isSelected = selectedDocumentIdSet.has(candidate.id);

          return (
            <article
              className={cx(
                "group relative flex items-start gap-6 rounded-[32px] border border-[color:var(--border-subtle)] p-6 transition-all duration-300",
                isSelected
                  ? "bg-[color:var(--bg-surface-strong)] border-[color:var(--border-strong)] shadow-[var(--shadow-surface)]"
                  : "bg-[color:var(--bg-surface-soft)] hover:border-[color:var(--border-strong)] hover:bg-[color:var(--bg-surface-strong)] hover:shadow-[var(--shadow-surface-muted)]",
              )}
              key={candidate.id}
            >
              <div className="relative mt-1.5 flex h-6 w-6 shrink-0 items-center justify-center">
                <input
                  checked={isSelected}
                  className="peer absolute z-10 h-full w-full cursor-pointer opacity-0"
                  onChange={(event) => handleToggleDocumentSelection(candidate.id, event.target.checked)}
                  type="checkbox"
                />
                <div className="h-full w-full rounded-full border border-[color:var(--border-strong)] bg-[color:var(--bg-surface)] transition-all peer-checked:border-[color:var(--button-primary-bg)] peer-checked:bg-[color:var(--button-primary-bg)] peer-checked:ring-4 peer-checked:ring-[color:var(--button-primary-bg)]/10" />
                <svg
                  className="absolute h-3 w-3 text-white opacity-0 transition-opacity peer-checked:opacity-100"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="4"
                  viewBox="0 0 24 24"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>

              <div className="min-w-0 flex-1 space-y-4">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  {candidate.hasSummary ? (
                     <div className="group/badge relative flex items-center justify-center">
                        <div className="absolute inset-0 scale-150 rounded-full bg-[color:var(--ai-card-accent)]/25 blur-xl opacity-0 transition-opacity duration-700 group-hover/badge:opacity-100" />
                        <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--ai-card-accent)]/10 text-[color:var(--ai-card-accent)] ring-1 ring-[color:var(--ai-card-accent)]/20 transition-all duration-300 group-hover/badge:scale-110 group-hover/badge:rotate-[15deg] group-hover/badge:bg-[color:var(--ai-card-accent)]/20">
                          <MagicWandIcon />
                        </div>
                     </div>
                  ) : null}
                  {candidate.isFavorite ? (
                    <div className="group/badge relative flex items-center justify-center">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-400/10 text-amber-500 transition-all duration-300 group-hover/badge:scale-110 group-hover/badge:bg-amber-400/20">
                        <PremiumStarIcon className="h-4 w-4" />
                      </div>
                      <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-[color:var(--text-primary)] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white opacity-0 transition-opacity group-hover/badge:opacity-100 shadow-xl">
                        Favorite
                      </span>
                    </div>
                  ) : null}
                  {candidate.highlightCount > 0 ? (
                    <div className="group/badge relative flex items-center justify-center">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--text-tertiary)]/10 text-[color:var(--text-tertiary)] transition-all duration-300 group-hover/badge:scale-110 group-hover/badge:bg-[color:var(--text-tertiary)]/20">
                        <NibIcon className="h-3.5 w-3.5" />
                        <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[color:var(--text-primary)] text-[9px] font-bold text-white ring-2 ring-[color:var(--bg-body)] tabular-nums">
                          {candidate.highlightCount}
                        </span>
                      </div>
                      <span className="pointer-events-none absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-[color:var(--text-primary)] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white opacity-0 transition-opacity group-hover/badge:opacity-100 shadow-xl">
                        {candidate.highlightCount} Highlights
                      </span>
                    </div>
                  ) : null}
                </div>
                
                <Link
                  className="block max-w-4xl font-ui-heading text-[1.3rem] font-bold leading-[1.2] tracking-[-0.02em] text-[color:var(--text-primary)] transition hover:text-[color:var(--text-primary-strong)] sm:text-[1.4rem]"
                  href={`/documents/${candidate.id}`}
                >
                  {candidate.title}
                </Link>

                <div className="flex items-center justify-between pt-2">
                  <div className="flex items-center gap-2.5 text-[13px] text-[color:var(--text-tertiary)]">
                    {candidate.author ? (
                      <>
                        <span className="font-medium text-[color:var(--text-secondary)]">{candidate.author}</span>
                        <span>·</span>
                      </>
                    ) : null}
                    <span className="tabular-nums opacity-60">
                      {formatPublishedAtLabel(
                        candidate.publishedAt ?? null,
                        candidate.publishedAtKind ?? "UNKNOWN",
                        candidate.createdAt ?? candidate.updatedAt,
                      )}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-1.5 text-xs font-bold text-[color:var(--text-primary)] opacity-0 transition-all translate-x-2 group-hover:opacity-100 group-hover:translate-x-0">
                    <span className="tracking-widest uppercase text-[10px]">Open</span>
                    <ArrowRightIcon />
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function ArrowRightIcon() {
  return (
    <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" viewBox="0 0 24 24">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

function resolveDownloadFileName(contentDisposition: string | null, format: BatchDownloadFormat) {
  if (contentDisposition) {
    const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) return decodeURIComponent(utf8Match[1]);
    const fallbackMatch = contentDisposition.match(/filename="([^"]+)"/i);
    if (fallbackMatch?.[1]) return fallbackMatch[1];
  }
  const timestamp = new Date().toISOString().replaceAll(":", "").replaceAll("-", "").slice(0, 15);
  return `reader-batch-export-${format}-${timestamp}.zip`;
}
