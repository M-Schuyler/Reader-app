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
    <section className="space-y-7 md:space-y-8">
      <PageHeader
        actions={
          <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
            <span className="inline-flex min-h-9 items-center rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface-soft)] px-3.5 text-sm text-[color:var(--text-secondary)]">
              {data.documentCount} 篇
            </span>
            {contextChips.map((chip) => (
              <span
                className="inline-flex min-h-9 items-center rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface-soft)] px-3.5 text-sm text-[color:var(--text-secondary)]"
                key={chip}
              >
                {chip}
              </span>
            ))}
            <SourceLibraryMoreMenu />
          </div>
        }
        title="来源库"
      />

      <SourceLibraryIndex allDocumentsHref={allDocumentsHref} data={data} />
    </section>
  );
}
