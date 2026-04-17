import Link from "next/link";
import { SourceLibraryIndex } from "@/components/library/source-library";
import { SourceLibraryToolbar } from "@/components/library/source-library-toolbar";
import {
  buildSourceContextChips,
  buildSourceLibraryBrowseHref,
  buildSourceLibraryClearHref,
  parseSourceLibraryQuery,
  resolveSourceSearchParams,
} from "@/lib/documents/source-library-query";
import { getSourceLibraryIndex } from "@/server/modules/documents/document.service";

export const dynamic = "force-dynamic";

type SourceAllDocumentsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SourceAllDocumentsPage({ searchParams }: SourceAllDocumentsPageProps) {
  const resolvedSearchParams = await resolveSourceSearchParams(searchParams);
  const parsedQuery = parseSourceLibraryQuery(resolvedSearchParams);
  const data = await getSourceLibraryIndex({
    ...parsedQuery,
    timeRange: "all",
    surface: "source",
  });
  const hasActiveFilters = Boolean(data.filters.q || data.filters.type || data.filters.tag || data.filters.sort !== "latest");
  const backHref = buildSourceLibraryBrowseHref("/sources", {
    ...parsedQuery,
    surface: "source",
  });
  const clearHref = buildSourceLibraryClearHref("/sources/all", data.filters);
  const contextChips = buildSourceContextChips(data.filters, undefined, { sortContext: "sourceIndex" });

  return (
    <section className="space-y-8">
      <header className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--bg-surface-soft)] text-[color:var(--text-secondary)] transition hover:bg-[color:var(--border-subtle)] hover:text-[color:var(--text-primary)]"
              href={backHref}
              title="返回来源库"
            >
              <span aria-hidden="true" className="text-xl">
                ←
              </span>
            </Link>
            <div>
              <h1 className="font-ui-heading text-3xl font-bold tracking-tight text-[color:var(--text-primary)]">
                所有来源
              </h1>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--text-tertiary)]">
                Sources / All Sources
              </p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-3">
            <span className="rounded-full bg-[color:var(--bg-surface-soft)] px-3 py-1 text-sm font-medium text-[color:var(--text-tertiary)]">
              {data.groups.length} 个来源
            </span>
          </div>
        </div>

        <SourceLibraryToolbar
          clearHref={clearHref}
          filters={data.filters}
          hasActiveFilters={hasActiveFilters}
          showFilters
          sortContext="sourceIndex"
          variant="minimal"
        />
      </header>

      {contextChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-1">
          {contextChips.map((chip) => (
            <span
              className="inline-flex h-8 items-center rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface-soft)] px-3 text-sm text-[color:var(--text-secondary)]"
              key={chip}
            >
              {chip}
            </span>
          ))}
          {hasActiveFilters && (
            <Link
              className="ml-2 text-sm font-bold text-[color:var(--ai-card-accent)] hover:underline"
              href={clearHref}
            >
              清空筛选
            </Link>
          )}
        </div>
      )}

      <SourceLibraryIndex data={data} hideRecentLabel={true} title="全部来源" />
    </section>
  );
}
