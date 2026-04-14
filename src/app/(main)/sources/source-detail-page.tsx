import { notFound } from "next/navigation";
import Link from "next/link";
import {
  SourceAliasEditor,
  SourceLibraryDetail,
} from "@/components/library/source-library-detail";
import { SourceLibraryDetailFilters } from "@/components/library/source-library-detail-filters";
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
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Link
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface-soft)] text-[color:var(--text-secondary)] transition hover:border-[color:var(--border-strong)] hover:text-[color:var(--text-primary)]"
            href={backHref}
            title="返回来源库"
          >
            <span aria-hidden="true" className="text-lg">←</span>
          </Link>
          <div className="h-4 w-px bg-[color:var(--border-subtle)]" />
          <div className="flex flex-col">
            <h1 className="font-ui-heading text-xl font-bold tracking-tight text-[color:var(--text-primary)]">
              {sourceContext.label}
            </h1>
            <div className="flex items-center gap-2">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--text-tertiary)] opacity-60">
                {sourceContext.meta}
              </p>
              {contextChips.length > 0 && (
                <>
                  <span className="text-[10px] text-[color:var(--border-subtle)]">·</span>
                  <div className="flex gap-1.5">
                    {contextChips.map((chip) => (
                      <span key={chip} className="text-[10px] font-bold text-[color:var(--ai-card-accent)] uppercase tracking-wider">{chip}</span>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <SourceAliasEditor source={sourceContext} />
          <div className="h-4 w-px bg-[color:var(--border-subtle)]" />
          <SourceLibraryDetailFilters
            clearHref={clearHref}
            contentOrigin={data.contentOrigin}
            filters={data.filters}
            hasActiveFilters={hasActiveFilters}
          />
        </div>
      </div>

      <SourceLibraryDetail data={data} />
    </section>
  );
}
