import { SourceLibraryIndex } from "@/components/library/source-library";
import { SourceLibraryToolbar } from "@/components/library/source-library-toolbar";
import {
  buildSourceContextChips,
  buildSourceLibraryClearHref,
  parseSourceLibraryQuery,
  resolveSourceSearchParams,
} from "@/lib/documents/source-library-query";
import { collectSourceAliasLookups } from "@/lib/documents/source-library";
import { getDocuments, getSourceAliasMapForSources } from "@/server/modules/documents/document.service";

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
  const sourceAliasMap = await getSourceAliasMapForSources(collectSourceAliasLookups(data.items));
  const hasActiveFilters = Boolean(data.filters.q || data.filters.type || data.filters.sort !== "latest");
  const clearHref = buildSourceLibraryClearHref("/sources", data.filters);
  const contextChips = buildSourceContextChips(data.filters);

  return (
    <section className="space-y-7 md:space-y-8">
      <div className="flex flex-col gap-4 border-b border-[color:var(--border-subtle)] pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-ui-heading text-[clamp(2.8rem,5vw,4.35rem)] leading-[0.92] tracking-[-0.06em] text-[color:var(--text-primary-strong)]">
            来源库
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <span className="inline-flex min-h-9 items-center rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface-soft)] px-3.5 text-sm text-[color:var(--text-secondary)]">
            {data.pagination.total} 篇
          </span>
          {contextChips.map((chip) => (
            <span
              className="inline-flex min-h-9 items-center rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface-soft)] px-3.5 text-sm text-[color:var(--text-secondary)]"
              key={chip}
            >
              {chip}
            </span>
          ))}
        </div>
      </div>

      <SourceLibraryToolbar clearHref={clearHref} filters={data.filters} hasActiveFilters={hasActiveFilters} />

      <SourceLibraryIndex aliasMap={sourceAliasMap} data={data} />
    </section>
  );
}
