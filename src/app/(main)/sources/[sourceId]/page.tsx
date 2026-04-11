import { notFound } from "next/navigation";
import {
  SourceLibraryDetail,
  SourceLibraryDetailFilterState,
  SourceLibraryDetailHeaderMeta,
  SourceSyncButton,
} from "@/components/library/source-library-detail";
import { PageHeader } from "@/components/ui/page-header";
import { shouldEnableContentOriginForSourceDetail } from "@/lib/documents/content-origin";
import {
  buildSourceContextChips,
  buildSourceLibraryBrowseHref,
  buildSourceLibraryClearHref,
  parseSourceLibraryQuery,
  resolveSourceSearchParams,
} from "@/lib/documents/source-library-query";
import { getDocuments } from "@/server/modules/documents/document.service";
import { getSource } from "@/server/modules/sources/source.service";

export const dynamic = "force-dynamic";

type SourcePageProps = {
  params: Promise<{ sourceId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function NamedSourceDetailPage({ params, searchParams }: SourcePageProps) {
  const [{ sourceId }, resolvedSearchParams] = await Promise.all([params, resolveSourceSearchParams(searchParams)]);
  const parsedQuery = parseSourceLibraryQuery(resolvedSearchParams);
  const sourceData = await getSource(sourceId);

  if (!sourceData) {
    notFound();
  }

  const enableContentOrigin = shouldEnableContentOriginForSourceDetail({
    sourceUrl: sourceData.source.siteUrl ?? sourceData.source.locatorUrl,
  });
  const data = await getDocuments({
    ...parsedQuery,
    enableContentOrigin,
    surface: "source",
    sourceId,
  } as Parameters<typeof getDocuments>[0]);
  const contextChips = buildSourceContextChips(data.filters, data.contentOrigin?.options, { sortContext: "documentList" });
  const backHref = buildSourceLibraryBrowseHref("/sources", {
    ...parsedQuery,
    surface: "source",
  });
  const detailHref = `/sources/${encodeURIComponent(sourceId)}`;
  const clearHref = buildSourceLibraryClearHref(detailHref, data.filters);
  const hasActiveFilters = Boolean(data.filters.q || data.filters.tag || data.filters.origin || data.filters.sort !== "latest");
  const host = resolveHostname(sourceData.source.siteUrl ?? sourceData.source.locatorUrl);
  const latestCreatedAt = data.items[0]?.createdAt ?? sourceData.source.lastSyncedAt ?? sourceData.source.createdAt;
  const sync = {
    sourceId: sourceData.source.id,
    lastSyncedAt: sourceData.source.lastSyncedAt,
    lastSyncStatus: sourceData.source.lastSyncStatus,
    lastSyncError: sourceData.source.lastSyncError,
  } as const;
  const sourceContext = {
    id: `source:${sourceData.source.id}`,
    label: sourceData.source.title,
    defaultLabel: sourceData.source.title,
    customLabel: null,
    host,
    kind: "source" as const,
    value: sourceData.source.id,
    href: `/sources/${encodeURIComponent(sourceData.source.id)}`,
    latestCreatedAt,
    meta: `${sourceData.source.documentCount} 篇文章`,
    totalItems: sourceData.source.documentCount,
  };

  return (
    <section className="space-y-8 md:space-y-10">
      <PageHeader
        actions={<SourceSyncButton sourceId={sourceData.source.id} />}
        className="gap-6 lg:items-start"
        description="这里看到的是一个明确命名的来源，而不是仅按域名回推的临时聚合。"
        eyebrow="Source detail"
        meta={<SourceLibraryDetailHeaderMeta includeCategories={sourceData.source.includeCategories} source={sourceContext} sync={sync} />}
        title={sourceData.source.title}
      />

      <SourceLibraryDetailFilterState contextChips={contextChips} />

      <SourceLibraryDetail
        backHref={backHref}
        clearHref={clearHref}
        data={data}
        hasActiveFilters={hasActiveFilters}
        source={sourceContext}
      />
    </section>
  );
}

function resolveHostname(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
}
