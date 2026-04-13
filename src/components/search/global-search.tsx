"use client";

import { IngestionStatus } from "@prisma/client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { TextInput } from "@/components/ui/form-controls";
import { resolveGlobalSearchPanelState } from "@/lib/search/global-search-panel";
import { cx } from "@/utils/cx";
import type { ApiError, ApiSuccess } from "@/server/api/response";
import type { QuickSearchResponseData } from "@/server/modules/documents/document.types";

type QuickSearchApiResponse = ApiSuccess<QuickSearchResponseData> | ApiError;
export type GlobalSearchProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const MAX_RESULTS = 6;

export function GlobalSearch(props: GlobalSearchProps): JSX.Element | null;
export function GlobalSearch(props?: Partial<GlobalSearchProps>): JSX.Element | null;
export function GlobalSearch({ open = false, onOpenChange = () => {} }: Partial<GlobalSearchProps> = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<QuickSearchResponseData["items"]>([]);
  const [error, setError] = useState<string | null>(null);
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const trimmedQuery = query.trim();
  const viewAllHref = trimmedQuery ? `/sources?q=${encodeURIComponent(trimmedQuery)}` : "/sources";
  const panelState = resolveGlobalSearchPanelState({
    error,
    isLoading,
    open,
    query,
    resultsCount: results.length,
  });
  const showPanel = panelState.kind !== "closed";

  useEffect(() => {
    onOpenChange(false);
    setResults([]);
    setActiveIndex(0);
    setError(null);
    setQuery("");
  }, [onOpenChange, pathname]);

  useEffect(() => {
    if (!trimmedQuery) {
      setResults([]);
      setError(null);
      setIsLoading(false);
      setActiveIndex(0);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/documents/quick-search?q=${encodeURIComponent(trimmedQuery)}`, {
          signal: controller.signal,
        });
        const payload = (await response.json()) as QuickSearchApiResponse;

        if (!payload.ok) {
          throw new Error(payload.error.message);
        }

        setResults(payload.data.items.slice(0, MAX_RESULTS));
        setActiveIndex(0);
      } catch (fetchError) {
        if (controller.signal.aborted) {
          return;
        }

        setResults([]);
        setError(fetchError instanceof Error ? fetchError.message : "搜索失败，请稍后再试。");
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
          setOpen(true);
        }
      }
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [trimmedQuery]);

  useEffect(() => {
    if (!open) {
      return;
    }

    inputRef.current?.focus();
  }, [open]);

  const activeResult = useMemo(() => results[activeIndex] ?? null, [activeIndex, results]);

  if (!open) {
    return null;
  }

  function navigateToDocument(id: string) {
    onOpenChange(false);
    setQuery("");
    router.push(`/documents/${id}`);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (activeResult) {
      navigateToDocument(activeResult.id);
      return;
    }

    router.push(viewAllHref);
    onOpenChange(false);
  }

  return (
    <div className="fixed inset-0 z-50">
      <button
        aria-label="关闭搜索"
        className="absolute inset-0 h-full w-full cursor-default bg-[color:var(--bg-overlay)]"
        onClick={() => onOpenChange(false)}
        type="button"
      />

      <div className="relative flex min-h-full items-center justify-center px-4 py-6 sm:px-6">
        <div
          className="relative z-10 w-full max-w-3xl overflow-hidden rounded-[28px] border border-[color:var(--border-strong)] bg-[color:var(--bg-surface-strong)] shadow-[var(--shadow-surface)]"
          onClick={(event) => event.stopPropagation()}
        >
          <form onSubmit={handleSubmit}>
            <div className="border-b border-[color:var(--border-subtle)] px-4 py-4 sm:px-5">
              <label className="sr-only" htmlFor={inputId}>
                全局搜索
              </label>
              <div className="flex items-center gap-3 rounded-[20px] border border-[color:var(--border-strong)] bg-[color:var(--bg-surface)] px-4 py-3">
                <SearchIcon />
                <TextInput
                  autoComplete="off"
                  className="h-6 border-0 bg-transparent p-0 text-sm shadow-none outline-none placeholder:text-stone-400 focus-visible:ring-0 focus-visible:ring-offset-0"
                  id={inputId}
                  ref={inputRef}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      onOpenChange(false);
                      return;
                    }

                    if (panelState.kind !== "results" || results.length === 0) {
                      return;
                    }

                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      setActiveIndex((current) => (current + 1) % results.length);
                    }

                    if (event.key === "ArrowUp") {
                      event.preventDefault();
                      setActiveIndex((current) => (current - 1 + results.length) % results.length);
                    }
                  }}
                  placeholder="搜索文档"
                  type="search"
                  value={query}
                />
              </div>
            </div>

            {showPanel ? (
              <div className="max-h-[min(60vh,32rem)] overflow-y-auto p-2">
                {panelState.kind === "loading" ? (
                  <div className="px-4 py-4 text-sm text-[color:var(--text-secondary)]">搜索中…</div>
                ) : panelState.kind === "error" ? (
                  <div className="px-4 py-4 text-sm text-[color:var(--badge-danger-text)]">{panelState.message}</div>
                ) : panelState.kind === "empty" ? (
                  <div className="px-4 py-4 text-sm text-[color:var(--text-secondary)]">{panelState.message}</div>
                ) : (
                  results.map((item, index) => (
                    <button
                      className={cx(
                        "block w-full rounded-[18px] px-4 py-3 text-left transition",
                        index === activeIndex
                          ? "bg-[color:var(--bg-surface-soft)]"
                          : "hover:bg-[color:var(--bg-surface-soft)]",
                      )}
                      key={item.id}
                      onClick={() => navigateToDocument(item.id)}
                      onMouseEnter={() => setActiveIndex(index)}
                      type="button"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-[color:var(--text-tertiary)]">
                          <span>{formatPublishedAt(item.publishedAt, item.publishedAtKind)}</span>
                          {item.ingestionStatus !== IngestionStatus.READY ? (
                            <span>{formatIngestionStatus(item.ingestionStatus)}</span>
                          ) : null}
                        </div>
                        <p className="line-clamp-2 text-sm font-medium leading-6 text-[color:var(--text-primary)]">{item.title}</p>
                        <p className="line-clamp-1 text-sm text-[color:var(--text-secondary)]">{resolvePreviewText(item)}</p>
                        <p className="line-clamp-1 text-xs text-[color:var(--text-tertiary)]">
                          {truncateUrl(item.canonicalUrl ?? item.sourceUrl)}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            ) : null}

            <div className="border-t border-[color:var(--border-subtle)] px-2 py-2">
              <Link
                className="block rounded-[18px] px-4 py-3 text-sm font-medium text-[color:var(--text-secondary)] transition hover:bg-[color:var(--bg-surface-soft)] hover:text-[color:var(--text-primary)]"
                href={viewAllHref}
                onClick={() => onOpenChange(false)}
              >
                在来源库查看全部结果
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4.5 w-4.5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
      viewBox="0 0 20 20"
    >
      <circle cx="8.5" cy="8.5" r="4.75" />
      <path d="m12.2 12.2 4.1 4.1" />
    </svg>
  );
}

function resolvePreviewText(item: QuickSearchResponseData["items"][number]) {
  if (item.ingestionStatus === IngestionStatus.FAILED) {
    return "正文暂不可读";
  }

  return item.aiSummary ?? item.excerpt ?? "暂无摘要";
}

function truncateUrl(value: string | null) {
  if (!value) {
    return "未知来源";
  }

  try {
    const url = new URL(value);
    return `${url.hostname}${url.pathname === "/" ? "" : url.pathname}`;
  } catch {
    return value;
  }
}

function formatPublishedAt(value: string | null, kind: QuickSearchResponseData["items"][number]["publishedAtKind"]) {
  if (!value) {
    return "未知发布时间";
  }

  const formatted = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));

  return kind === "BEFORE" ? `${formatted} 之前` : formatted;
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
