import { SourceLibraryIndex } from "@/components/library/source-library";
import { SourceLibraryMoreMenu } from "@/components/library/source-library-more-menu";
import { PageHeader } from "@/components/ui/page-header";
import {
  buildSourceContextChips,
  buildSourceLibraryBrowseHref,
  parseSourceLibraryQuery,
  resolveSourceSearchParams,
} from "@/lib/documents/source-library-query";
import { getSourceLibraryIndex } from "@/server/modules/documents/document.service";

export const dynamic = "force-dynamic";

type SourcesPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SourcesPage({ searchParams }: SourcesPageProps) {
  const resolvedSearchParams = await resolveSourceSearchParams(searchParams);
  const parsedQuery = parseSourceLibraryQuery(resolvedSearchParams);
  const data = await getSourceLibraryIndex({
    ...parsedQuery,
    surface: "source",
  });
  const allDocumentsHref = buildSourceLibraryBrowseHref("/sources/all", {
    ...parsedQuery,
    surface: "source",
  });
  const contextChips = buildSourceContextChips(data.filters, undefined, { sortContext: "sourceIndex" });

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <h1 className="font-ui-heading text-2xl font-bold tracking-tight text-[color:var(--text-primary)]">
            Sources
          </h1>
          <div className="h-4 w-px bg-[color:var(--border-subtle)] hidden sm:block" />
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 items-center rounded-full bg-stone-900/5 px-3 text-[13px] font-bold text-[color:var(--text-secondary)]">
              {data.documentCount} 篇
            </span>
            {contextChips.map((chip) => (
              <span
                className="inline-flex h-8 items-center rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface-soft)] px-3 text-[13px] font-medium text-[color:var(--text-tertiary)]"
                key={chip}
              >
                {chip}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2">
          <SourceLibraryMoreMenu />
        </div>
      </div>

      <SourceLibraryIndex allDocumentsHref={allDocumentsHref} data={data} />
    </section>
  );
}
