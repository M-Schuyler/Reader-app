"use client";

import { IngestionStatus, DocumentType } from "@prisma/client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, type FormEvent } from "react";
import { MagicWandIcon } from "@/components/icons/magic-wand-icon";
import { TextInput } from "@/components/ui/form-controls";
import { Badge } from "@/components/ui/badge";
import { resolveGlobalSearchPanelState } from "@/lib/search/global-search-panel";
import { cx } from "@/utils/cx";
import type { ApiError, ApiSuccess } from "@/server/api/response";
import type { QuickSearchResponseData, QuickSearchResult } from "@/server/modules/documents/document.types";

type QuickSearchApiResponse = ApiSuccess<QuickSearchResponseData> | ApiError;

export type GlobalSearchProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const MAX_RESULTS = 8;

type QuickAction = {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
};

const QUICK_ACTIONS: QuickAction[] = [
  { id: "reading", label: "前往待读列表", href: "/reading", icon: <BookIcon /> },
  { id: "sources", label: "管理内容来源", href: "/sources", icon: <LayersIcon /> },
  { id: "highlights", label: "查看我的划线", href: "/highlights", icon: <HighlightIcon /> },
  { id: "export", label: "导出文献库", href: "/export", icon: <ExportIcon /> },
];

const COMMANDS = [
  { id: "reading", label: "跳转到：待读列表", href: "/reading", icon: <BookIcon /> },
  { id: "sources", label: "跳转到：来源库", href: "/sources", icon: <LayersIcon /> },
  { id: "highlights", label: "跳转到：我的划线", href: "/highlights", icon: <HighlightIcon /> },
  { id: "export", label: "跳转到：导出", href: "/export", icon: <ExportIcon /> },
];

export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
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
  const isCommandMode = trimmedQuery.startsWith("/");
  const commandQuery = isCommandMode ? trimmedQuery.slice(1).toLowerCase() : "";

  const filteredCommands = useMemo(() => {
    if (!isCommandMode) return [];
    return COMMANDS.filter(cmd => cmd.label.toLowerCase().includes(commandQuery) || cmd.id.includes(commandQuery));
  }, [isCommandMode, commandQuery]);

  const panelState = resolveGlobalSearchPanelState({
    error,
    isLoading,
    open,
    query,
    resultsCount: isCommandMode ? filteredCommands.length : results.length,
  });

  useEffect(() => {
    onOpenChange(false);
    setResults([]);
    setActiveIndex(0);
    setError(null);
    setQuery("");
  }, [onOpenChange, pathname]);

  useEffect(() => {
    if (!trimmedQuery || isCommandMode) {
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
        }
      }
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [trimmedQuery, isCommandMode]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onOpenChange(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onOpenChange, open]);

  const activeResult = useMemo(() => results[activeIndex] ?? null, [activeIndex, results]);
  const activeCommand = useMemo(() => filteredCommands[activeIndex] ?? null, [activeIndex, filteredCommands]);

  if (!open) return null;

  function handleSelect(href: string) {
    onOpenChange(false);
    setQuery("");
    router.push(href);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isCommandMode && activeCommand) {
      handleSelect(activeCommand.href);
      return;
    }
    if (activeResult) {
      handleSelect(`/reading/${activeResult.id}`);
      return;
    }
    if (trimmedQuery && !isCommandMode) {
      handleSelect(`/sources?q=${encodeURIComponent(trimmedQuery)}`);
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      <button
        aria-label="关闭搜索"
        className="absolute inset-0 h-full w-full cursor-pointer bg-[color:var(--bg-overlay)] backdrop-blur-[2px]"
        onClick={() => onOpenChange(false)}
        type="button"
      />

      <div className="pointer-events-none relative flex min-h-full items-start justify-center px-4 py-12 sm:px-6 md:py-24">
        <div
          className="pointer-events-auto relative z-10 w-full max-w-5xl overflow-hidden rounded-[32px] border border-[color:var(--border-strong)] bg-[color:var(--bg-surface-strong)] shadow-[var(--shadow-surface)]"
          onClick={(event) => event.stopPropagation()}
        >
          <form onSubmit={handleSubmit}>
            <div className="border-b border-[color:var(--border-subtle)] px-5 py-5 sm:px-6">
              <div className="flex items-center gap-4 rounded-[22px] border border-[color:var(--border-strong)] bg-[color:var(--bg-surface)] px-5 py-3.5 shadow-sm transition-focus-within focus-within:border-[color:var(--ai-card-accent)] focus-within:ring-2 focus-within:ring-[color:var(--ai-card-accent)]/10">
                <SearchIcon className={cx("h-5 w-5 transition-colors", trimmedQuery ? "text-[color:var(--ai-card-accent)]" : "text-[color:var(--text-tertiary)]")} />
                <TextInput
                  autoComplete="off"
                  className="h-7 flex-1 border-0 bg-transparent p-0 text-base shadow-none outline-none placeholder:text-stone-400 focus-visible:ring-0 focus-visible:ring-offset-0"
                  id={inputId}
                  ref={inputRef}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      onOpenChange(false);
                      return;
                    }

                    const itemsCount = isCommandMode ? filteredCommands.length : results.length;
                    if (itemsCount === 0) return;

                    if (event.key === "ArrowDown") {
                      event.preventDefault();
                      setActiveIndex((current) => (current + 1) % itemsCount);
                    }
                    if (event.key === "ArrowUp") {
                      event.preventDefault();
                      setActiveIndex((current) => (current - 1 + itemsCount) % itemsCount);
                    }
                  }}
                  placeholder="输入关键字搜索，或输入 / 使用快捷命令"
                  type="search"
                  value={query}
                />
                {isCommandMode && (
                  <div className="rounded-md bg-[color:var(--ai-card-accent)]/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[color:var(--ai-card-accent)]">
                    Command Mode
                  </div>
                )}
              </div>
            </div>

            <div className="flex min-h-[400px]">
              {/* Results List */}
              <div className={cx(
                "flex-1 overflow-y-auto p-3 md:flex-[0.4] md:border-r md:border-[color:var(--border-subtle)]",
                !trimmedQuery && "md:flex-1 md:border-r-0"
              )}>
                {!trimmedQuery ? (
                  <div className="space-y-6 py-4 px-3">
                    <div className="space-y-3">
                      <h3 className="px-3 text-[11px] font-bold uppercase tracking-[0.15em] text-[color:var(--text-tertiary)]">快速操作</h3>
                      <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                        {QUICK_ACTIONS.map((action) => (
                          <button
                            key={action.id}
                            className="flex items-center gap-3 rounded-[18px] px-4 py-3.5 text-left transition hover:bg-[color:var(--bg-surface-soft)] group"
                            onClick={() => handleSelect(action.href)}
                            type="button"
                          >
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[color:var(--bg-surface-soft)] text-[color:var(--text-secondary)] transition group-hover:bg-[color:var(--bg-surface)] group-hover:text-[color:var(--text-primary)]">
                              {action.icon}
                            </div>
                            <span className="text-sm font-medium text-[color:var(--text-secondary)] group-hover:text-[color:var(--text-primary)]">{action.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {panelState.kind === "loading" ? (
                      <div className="px-4 py-8 text-center text-sm text-[color:var(--text-secondary)] animate-pulse">正在检索...</div>
                    ) : panelState.kind === "error" ? (
                      <div className="px-4 py-8 text-center text-sm text-[color:var(--badge-danger-text)]">{panelState.message}</div>
                    ) : panelState.kind === "empty" ? (
                      <div className="px-4 py-8 text-center text-sm text-[color:var(--text-secondary)]">{panelState.message}</div>
                    ) : isCommandMode ? (
                      filteredCommands.map((cmd, index) => (
                        <button
                          key={cmd.id}
                          className={cx(
                            "flex w-full items-center gap-3 rounded-[18px] px-4 py-3.5 text-left transition",
                            index === activeIndex ? "bg-[color:var(--bg-surface-soft)] ring-1 ring-inset ring-[color:var(--border-strong)]" : "hover:bg-[color:var(--bg-surface-soft)]"
                          )}
                          onClick={() => handleSelect(cmd.href)}
                          onMouseEnter={() => setActiveIndex(index)}
                          type="button"
                        >
                          <div className={cx(
                            "flex h-9 w-9 items-center justify-center rounded-xl transition",
                            index === activeIndex ? "bg-[color:var(--ai-card-accent)] text-white" : "bg-[color:var(--bg-surface-soft)] text-[color:var(--text-tertiary)]"
                          )}>
                            {cmd.icon}
                          </div>
                          <span className={cx("text-sm font-medium", index === activeIndex ? "text-[color:var(--text-primary)]" : "text-[color:var(--text-secondary)]")}>
                            {cmd.label}
                          </span>
                        </button>
                      ))
                    ) : (
                      results.map((item, index) => (
                        <button
                          key={item.id}
                          className={cx(
                            "block w-full rounded-[20px] px-4 py-4 text-left transition",
                            index === activeIndex
                              ? "bg-[color:var(--bg-surface-soft)] ring-1 ring-inset ring-[color:var(--border-strong)] shadow-sm"
                              : "hover:bg-[color:var(--bg-surface-soft)]",
                          )}
                          onClick={() => handleSelect(`/reading/${item.id}`)}
                          onMouseEnter={() => setActiveIndex(index)}
                          type="button"
                        >
                          <div className="flex gap-3">
                            <div className={cx(
                              "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] text-[color:var(--text-tertiary)]",
                              index === activeIndex && "border-[color:var(--border-strong)] text-[color:var(--text-secondary)]"
                            )}>
                              <DocumentTypeIcon type={item.type} />
                            </div>
                            <div className="min-w-0 flex-1 space-y-1.5">
                              <p className={cx(
                                "line-clamp-1 text-[13px] font-semibold leading-tight tracking-tight transition-colors",
                                index === activeIndex ? "text-[color:var(--text-primary-strong)]" : "text-[color:var(--text-primary)]"
                              )}>
                                {item.title}
                              </p>
                              <div className="flex items-center gap-2 text-[11px] font-medium text-[color:var(--text-tertiary)]">
                                <span className="uppercase tracking-wider">{formatDocumentType(item.type)}</span>
                                <span>·</span>
                                <span>{formatPublishedAt(item.publishedAt, item.publishedAtKind)}</span>
                              </div>
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Preview Pane */}
              <div className="hidden flex-1 overflow-y-auto bg-[color:var(--bg-surface-soft)]/30 p-8 md:block md:flex-[0.6]">
                {activeResult ? (
                  <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-1.5">
                        <Badge tone="neutral" className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                          {formatDocumentType(activeResult.type)}
                        </Badge>
                        {activeResult.tags.map(tag => (
                          <Badge key={tag.slug} tone="subtle" className="px-2 py-0.5 text-[10px] font-medium">
                            #{tag.name}
                          </Badge>
                        ))}
                      </div>
                      <h2 className="font-display text-3xl leading-tight tracking-tight text-[color:var(--text-primary)]">
                        {activeResult.title}
                      </h2>
                      <div className="flex items-center gap-3 text-sm text-[color:var(--text-tertiary)]">
                        {activeResult.author && (
                          <>
                            <span className="font-medium text-[color:var(--text-secondary)]">{activeResult.author}</span>
                            <span>·</span>
                          </>
                        )}
                        <span>{formatPublishedAt(activeResult.publishedAt, activeResult.publishedAtKind)}</span>
                        {activeResult.wordCount && (
                          <>
                            <span>·</span>
                            <span>{formatWordCount(activeResult.wordCount)}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {activeResult.aiSummary ? (
                      <div className="relative space-y-3 overflow-hidden rounded-2xl border border-[color:var(--ai-card-border)] bg-[color:var(--ai-card-bg)] px-6 py-5 shadow-sm">
                        <div className="absolute left-0 top-0 h-full w-1 bg-[color:var(--ai-card-accent)] opacity-40" />
                        <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--ai-card-accent)]">
                          <MagicWandIcon className="h-3.5 w-3.5" />
                          <span>AI Summary</span>
                        </div>
                        <p className="text-[15px] font-medium leading-relaxed text-[color:var(--text-primary)] opacity-90">
                          {activeResult.aiSummary}
                        </p>
                      </div>
                    ) : activeResult.excerpt ? (
                      <div className="space-y-2">
                         <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[color:var(--text-tertiary)]">摘要</p>
                         <p className="text-[15px] leading-relaxed text-[color:var(--text-secondary)] italic">
                           "{activeResult.excerpt}"
                         </p>
                      </div>
                    ) : null}

                    <div className="space-y-3 rounded-2xl border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] p-5">
                      <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[color:var(--text-tertiary)]">来源详情</p>
                      <p className="line-clamp-2 break-all text-xs font-medium text-[color:var(--text-secondary)] opacity-80">
                        {activeResult.canonicalUrl ?? activeResult.sourceUrl ?? "未知来源地址"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full flex-col items-center justify-center space-y-4 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--bg-surface-soft)] text-[color:var(--text-tertiary)]/40">
                      <SearchIcon className="h-8 w-8" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-[color:var(--text-tertiary)]">实时预览</p>
                      <p className="text-xs text-[color:var(--text-tertiary)] opacity-60">选择一个结果以查看详细内容</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer with Keyboard Hints */}
            <div className="flex items-center justify-between border-t border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] px-6 py-3.5">
              <div className="flex items-center gap-5 text-[10px] font-medium text-[color:var(--text-tertiary)]">
                <div className="flex items-center gap-1.5">
                  <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-[color:var(--border-strong)] bg-[color:var(--bg-surface-soft)] px-1 font-sans text-[9px] font-bold shadow-sm">↵</kbd>
                  <span className="uppercase tracking-wider opacity-80">确认跳转</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-[color:var(--border-strong)] bg-[color:var(--bg-surface-soft)] px-1 font-sans text-[9px] font-bold shadow-sm">↑↓</kbd>
                  <span className="uppercase tracking-wider opacity-80">上下浏览</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded border border-[color:var(--border-strong)] bg-[color:var(--bg-surface-soft)] px-1 font-sans text-[9px] font-bold shadow-sm">ESC</kbd>
                  <span className="uppercase tracking-wider opacity-80">关闭</span>
                </div>
              </div>
              
              {!trimmedQuery ? (
                 <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-[color:var(--ai-card-accent)] opacity-80">
                   Omni Search
                 </div>
              ) : (
                <Link
                  className="text-[10px] font-bold uppercase tracking-[0.1em] text-[color:var(--text-secondary)] transition hover:text-[color:var(--text-primary)]"
                  href={trimmedQuery && !isCommandMode ? `/sources?q=${encodeURIComponent(trimmedQuery)}` : "/sources"}
                  onClick={() => onOpenChange(false)}
                >
                  在来源库查看全部 →
                </Link>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className ?? "h-4.5 w-4.5"}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function LayersIcon() {
  return (
    <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
    </svg>
  );
}

function HighlightIcon() {
  return (
    <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
      <path d="m9 11 3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </svg>
  );
}

function ExportIcon() {
  return (
    <svg className="h-4.5 w-4.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" x2="12" y1="15" y2="3" />
    </svg>
  );
}

function DocumentTypeIcon({ type }: { type: DocumentType }) {
  switch (type) {
    case DocumentType.RSS_ITEM:
      return (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M4 11a9 9 0 0 1 9 9" />
          <path d="M4 4a16 16 0 0 1 16 16" />
          <circle cx="5" cy="19" r="1" />
        </svg>
      );
    case DocumentType.PDF:
      return (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" x2="8" y1="13" y2="13" />
          <line x1="16" x2="8" y1="17" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      );
    case DocumentType.WEB_PAGE:
    default:
      return (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" />
          <line x1="2" x2="22" y1="12" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      );
  }
}

function formatDocumentType(value: DocumentType) {
  switch (value) {
    case DocumentType.WEB_PAGE:
      return "Web";
    case DocumentType.RSS_ITEM:
      return "RSS";
    case DocumentType.PDF:
      return "PDF";
    default:
      return value;
  }
}

function formatWordCount(value: number) {
  return `${new Intl.NumberFormat("zh-CN").format(value)} 字`;
}

function formatPublishedAt(value: string | null, kind: QuickSearchResult["publishedAtKind"]) {
  if (!value) {
    return "未知时间";
  }

  const formatted = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));

  return kind === "BEFORE" ? `${formatted} 前` : formatted;
}
