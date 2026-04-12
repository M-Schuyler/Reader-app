import { notFound } from "next/navigation";
import {
  SourceAliasEditor,
  SourceLibraryDetail,
  SourceLibraryDetailFilterState,
  SourceLibraryDetailHeaderMeta,
} from "@/components/library/source-library-detail";
import { PageHeader } from "@/components/ui/page-header";
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
        actions={<SourceAliasEditor source={sourceContext} />}
        className="gap-6 lg:items-start"
        eyebrow="Source detail"
        meta={<SourceLibraryDetailHeaderMeta source={sourceContext} />}
        title={sourceContext.label}
      />

      <SourceLibraryDetailFilterState contextChips={contextChips} />

      <SourceLibraryDetail backHref={backHref} clearHref={clearHref} data={data} hasActiveFilters={hasActiveFilters} source={sourceContext} />
    </section>
  );
}
