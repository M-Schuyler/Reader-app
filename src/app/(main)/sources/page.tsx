import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { SourceLibraryIndex } from "@/components/library/source-library";
import { SourceLibraryToolbar } from "@/components/library/source-library-toolbar";
import {
  buildSourceContextChips,
  buildSourceLibraryClearHref,
  parseSourceLibraryQuery,
  resolveSourceSearchParams,
} from "@/lib/documents/source-library-query";
import { getDocuments } from "@/server/modules/documents/document.service";

export const dynamic = "force-dynamic";

type SourcesPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SourcesPage({ searchParams }: SourcesPageProps) {
  const resolvedSearchParams = await resolveSourceSearchParams(searchParams);
  const parsedQuery = parseSourceLibraryQuery(resolvedSearchParams);
  const data = await getDocuments({
    ...parsedQuery,
    surface: "source",
  });
  const hasActiveFilters = Boolean(data.filters.q || data.filters.type || data.filters.sort !== "latest");
  const clearHref = buildSourceLibraryClearHref("/sources", data.filters);
  const contextChips = buildSourceContextChips(data.filters);

  return (
    <section className="space-y-8 md:space-y-10">
      <PageHeader
        className="gap-6"
        description="所有新收进来的内容先停在这里。它们不需要立刻进入 Reading，先安静排上书架就好。"
        eyebrow="Source Library"
        title="来源库"
      />

      <SourceLibraryToolbar clearHref={clearHref} filters={data.filters} hasActiveFilters={hasActiveFilters} />

      <Panel className="flex flex-col gap-3 rounded-[28px] border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between" tone="muted">
        <div className="space-y-1">
          <p className="text-sm text-[color:var(--text-secondary)]">
            当前共有 <span className="font-medium text-[color:var(--text-primary)]">{data.pagination.total}</span> 篇内容停在来源库里
          </p>
          <p className="text-sm text-[color:var(--text-tertiary)]">
            它们先按收入库的时间排成书架，等你判断哪些值得真正开始读。
          </p>
        </div>

        {contextChips.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {contextChips.map((chip) => (
              <span
                className="inline-flex min-h-8 items-center rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface-soft)] px-3 text-sm text-[color:var(--text-secondary)]"
                key={chip}
              >
                {chip}
              </span>
            ))}
          </div>
        ) : null}
      </Panel>

      <SourceLibraryIndex data={data} />
    </section>
  );
}
