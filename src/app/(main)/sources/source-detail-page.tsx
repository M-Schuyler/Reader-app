import { notFound } from "next/navigation";
import { SourceLibraryDetail } from "@/components/library/source-library-detail";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { shouldEnableContentOriginForSourceDetail } from "@/lib/documents/content-origin";
import { buildSourceLibrarySourceContext } from "@/lib/documents/source-library";
import {
  buildSourceContextChips,
  buildSourceLibraryBrowseHref,
  buildSourceLibraryClearHref,
  parseSourceLibraryQuery,
  resolveSourceSearchParams,
} from "@/lib/documents/source-library-query";
import type { DocumentSourceFilter } from "@/server/modules/documents/document.types";
import { getDocuments, getSourceAliasMapForSources } from "@/server/modules/documents/document.service";

type SourceDetailPageProps = {
  basePath: string;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
  source: DocumentSourceFilter;
};

export async function SourceDetailPage({ basePath, searchParams, source }: SourceDetailPageProps) {
  const resolvedSearchParams = await resolveSourceSearchParams(searchParams);
  const parsedQuery = parseSourceLibraryQuery(resolvedSearchParams);

  const overviewData = await getDocuments({
    surface: "source",
    source,
    page: 1,
    pageSize: 1,
    sort: "latest",
  });

  const representativeItem = overviewData.items[0];
  if (!representativeItem) {
    notFound();
  }

  const enableContentOrigin = shouldEnableContentOriginForSourceDetail({
    representativeCanonicalUrl: representativeItem.canonicalUrl,
    representativeSourceUrl: representativeItem.sourceUrl,
  });

  const data = await getDocuments({
    ...parsedQuery,
    enableContentOrigin,
    surface: "source",
    source,
  } as Parameters<typeof getDocuments>[0]);
  const sourceAliasMap = await getSourceAliasMapForSources([source]);
  const sourceContext = buildSourceLibrarySourceContext(representativeItem, overviewData.pagination.total, sourceAliasMap);
  const contextChips = buildSourceContextChips(data.filters, data.contentOrigin?.options, { sortContext: "documentList" });
  const backHref = buildSourceLibraryBrowseHref("/sources", {
    ...parsedQuery,
    surface: "source",
  });
  const clearHref = buildSourceLibraryClearHref(basePath, data.filters);
  const hasActiveFilters = Boolean(data.filters.q || data.filters.tag || data.filters.origin || data.filters.sort !== "latest");

  return (
    <section className="space-y-8 md:space-y-10">
      <PageHeader
        className="gap-6"
        description="这里不再混着所有来源。进到这一页后，你看到的是同一来源下的一整架内容。"
        eyebrow="Source detail"
        title={sourceContext.label}
      />

      {contextChips.length > 0 ? (
        <Panel
          className="flex flex-col gap-3 rounded-[28px] border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
          tone="muted"
        >
          <p className="text-sm text-[color:var(--text-secondary)]">当前正在这一来源里查看筛选后的结果。</p>
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
        </Panel>
      ) : null}

      <SourceLibraryDetail backHref={backHref} clearHref={clearHref} data={data} hasActiveFilters={hasActiveFilters} source={sourceContext} />
    </section>
  );
}
