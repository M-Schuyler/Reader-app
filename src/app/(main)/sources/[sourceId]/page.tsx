import { notFound } from "next/navigation";
import { SourceLibraryDetail } from "@/components/library/source-library-detail";
import { SourceLibraryToolbar } from "@/components/library/source-library-toolbar";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import {
  buildSourceContextChips,
  buildSourceLibraryBrowseHref,
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

  const data = await getDocuments({
    ...parsedQuery,
    surface: "source",
    sourceId,
  });
  const contextChips = buildSourceContextChips(data.filters, { sortContext: "documentList" });
  const backHref = buildSourceLibraryBrowseHref("/sources", {
    ...parsedQuery,
    surface: "source",
  });
  const host = resolveHostname(sourceData.source.siteUrl ?? sourceData.source.locatorUrl);
  const latestCreatedAt = data.items[0]?.createdAt ?? sourceData.source.lastSyncedAt ?? sourceData.source.createdAt;

  return (
    <section className="space-y-8 md:space-y-10">
      <PageHeader
        className="gap-6"
        description="这里看到的是一个明确命名的来源，而不是仅按域名回推的临时聚合。"
        eyebrow="Source detail"
        title={sourceData.source.title}
      />

      <SourceLibraryToolbar />

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

      <SourceLibraryDetail
        backHref={backHref}
        data={data}
        source={{
          id: `source:${sourceData.source.id}`,
          label: sourceData.source.title,
          defaultLabel: sourceData.source.title,
          customLabel: null,
          host,
          kind: "source",
          value: sourceData.source.id,
          href: `/sources/${encodeURIComponent(sourceData.source.id)}`,
          latestCreatedAt,
          meta: `${sourceData.source.documentCount} 篇文章`,
          totalItems: sourceData.source.documentCount,
        }}
        includeCategories={sourceData.source.includeCategories}
        sync={{
          sourceId: sourceData.source.id,
          lastSyncedAt: sourceData.source.lastSyncedAt,
          lastSyncStatus: sourceData.source.lastSyncStatus,
          lastSyncError: sourceData.source.lastSyncError,
        }}
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
