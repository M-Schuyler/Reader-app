import Link from "next/link";
import {
  getHighlightOverview,
  normalizeHighlightOverviewPage,
} from "@/server/modules/highlights/highlight-overview.service";

export const dynamic = "force-dynamic";

type HighlightsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HighlightsPage({ searchParams }: HighlightsPageProps) {
  const resolvedSearchParams = await resolveHighlightsSearchParams(searchParams);
  const page = normalizeHighlightOverviewPage(firstSearchParamValue(resolvedSearchParams.page));
  const overview = await getHighlightOverview(page);
  const hasPreviousPage = overview.pagination.page > 1;
  const hasNextPage = overview.pagination.page < overview.pagination.totalPages;

  const groupedHighlights = overview.highlights.reduce((acc, highlight) => {
    const date = formatDateKey(highlight.createdAt);
    if (!acc[date]) acc[date] = [];
    acc[date].push(highlight);
    return acc;
  }, {} as Record<string, typeof overview.highlights>);

  return (
    <section className="space-y-6">
      {/* 头部：与 Reading 和 Sources 页面的 Header 逻辑对齐 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <h1 className="font-ui-heading text-2xl font-bold tracking-tight text-[color:var(--text-primary)]">
            Highlights
          </h1>
          <div className="h-4 w-px bg-[color:var(--border-subtle)] hidden sm:block" />
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 items-center rounded-full bg-stone-900/5 px-3 text-[13px] font-bold text-[color:var(--text-secondary)] tabular-nums">
              {overview.pagination.total} 条
            </span>
          </div>
        </div>
      </div>

      {overview.highlights.length === 0 ? (
        <div className="py-20 text-center">
          <p className="text-[15px] text-[color:var(--text-tertiary)]">还没有任何高亮轨迹</p>
        </div>
      ) : (
        <div className="space-y-16">
          {Object.entries(groupedHighlights).map(([date, highlights]) => (
            <div className="space-y-6" key={date}>
              {/* 日期分隔：极具节奏感 */}
              <div className="sticky top-0 z-10 flex items-center gap-4 bg-[color:var(--bg-body)]/90 py-6 backdrop-blur-md">
                <span className="text-[11px] font-bold uppercase tracking-[0.35em] text-[color:var(--text-tertiary)]">
                  {date}
                </span>
                <div className="h-px flex-1 bg-gradient-to-r from-[color:var(--border-subtle)] to-transparent" />
              </div>

              <div className="space-y-12">
                {highlights.map((highlight) => (
                  <article className="group relative space-y-4" key={highlight.id}>
                    {/* 来源信息：与 Reading 页 Meta 信息对齐 */}
                    <div className="flex items-center gap-2.5 text-[12px] text-[color:var(--text-tertiary)]">
                      <span className="tabular-nums opacity-60">{formatTime(highlight.createdAt)}</span>
                      <span>·</span>
                      <Link 
                        className="truncate font-medium transition hover:text-[color:var(--text-primary)]" 
                        href={`/reading/${highlight.document.id}#highlight-${highlight.id}`}
                      >
                        {highlight.document.title}
                      </Link>
                    </div>
                    
                    {/* 高亮正文：使用 Reading 页 Prose 风格 */}
                    <div className="relative">
                      <blockquote className="max-w-4xl text-base font-serif leading-relaxed text-[color:var(--text-primary)] transition-colors group-hover:text-[color:var(--text-primary-strong)] sm:text-[17px]">
                        <Link href={`/reading/${highlight.document.id}#highlight-${highlight.id}`} className="block">
                          “{highlight.quoteText}”
                        </Link>
                      </blockquote>
                    </div>

                    {/* 批注：采用 Reading 页 AI Card 风格的精致化处理 */}
                    {highlight.note ? (
                      <div className="relative overflow-hidden rounded-2xl border border-[color:var(--ai-card-border)] bg-[color:var(--ai-card-bg)] px-6 py-4 shadow-[var(--shadow-surface-muted)] transition-shadow group-hover:shadow-[var(--shadow-surface)]">
                        <div className="absolute left-0 top-0 h-full w-1 bg-[color:var(--ai-card-accent)] opacity-40" />
                        <p className="text-[15px] leading-relaxed text-[color:var(--text-primary)] opacity-90">
                          {highlight.note}
                        </p>
                      </div>
                    ) : null}
                  </article>
                ))}
              </div>
            </div>
          ))}

          {/* 翻页：底部导航与 Reading 页的 Next Up 卡片间距对齐 */}
          <nav className="flex items-center justify-between border-t border-[color:var(--border-subtle)] pt-16">
            <div className="flex gap-12 text-[12px] font-bold uppercase tracking-[0.25em]">
              {hasPreviousPage ? (
                <Link className="text-[color:var(--text-secondary)] transition hover:text-[color:var(--text-primary)]" href={buildHighlightsPageHref(overview.pagination.page - 1)}>
                  Earlier
                </Link>
              ) : (
                <span className="text-[color:var(--text-tertiary)] opacity-30">Earlier</span>
              )}
              {hasNextPage ? (
                <Link className="text-[color:var(--text-secondary)] transition hover:text-[color:var(--text-primary)]" href={buildHighlightsPageHref(overview.pagination.page + 1)}>
                  Older
                </Link>
              ) : (
                <span className="text-[color:var(--text-tertiary)] opacity-30">Older</span>
              )}
            </div>
            <span className="text-[11px] font-medium tabular-nums text-[color:var(--text-tertiary)]">
              {overview.pagination.page} / {overview.pagination.totalPages}
            </span>
          </nav>
        </div>
      )}
    </section>
  );
}

function formatDateKey(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function firstSearchParamValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function buildHighlightsPageHref(page: number) {
  return page <= 1 ? "/highlights" : `/highlights?page=${page}`;
}

async function resolveHighlightsSearchParams(
  input: HighlightsPageProps["searchParams"],
): Promise<Record<string, string | string[] | undefined>> {
  return (await input) ?? {};
}
