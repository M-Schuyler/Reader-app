import { notFound } from "next/navigation";
import { SourceLibraryDetail } from "@/components/library/source-library-detail";
import { SourceLibraryToolbar } from "@/components/library/source-library-toolbar";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { buildSourceLibrarySourceContext } from "@/lib/documents/source-library";
import {
  buildSourceContextChips,
  buildSourceLibraryClearHref,
  parseSourceLibraryQuery,
  resolveSourceSearchParams,
} from "@/lib/documents/source-library-query";
import type { DocumentSourceFilter } from "@/server/modules/documents/document.types";
import { getDocuments } from "@/server/modules/documents/document.service";

type SourceDetailPageProps = {
  basePath: string;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
  source: DocumentSourceFilter;
};

export async function SourceDetailPage({ basePath, searchParams, source }: SourceDetailPageProps) {
  const resolvedSearchParams = await resolveSourceSearchParams(searchParams);
  const parsedQuery = parseSourceLibraryQuery(resolvedSearchParams);

  const [overviewData, data] = await Promise.all([
    getDocuments({
      surface: "source",
      source,
      page: 1,
      pageSize: 1,
      sort: "latest",
    }),
    getDocuments({
      ...parsedQuery,
      surface: "source",
      source,
    }),
  ]);

  const representativeItem = overviewData.items[0];
  if (!representativeItem) {
    notFound();
  }

  const sourceContext = buildSourceLibrarySourceContext(representativeItem, overviewData.pagination.total);
  const hasActiveFilters = Boolean(data.filters.q || data.filters.type || data.filters.sort !== "latest");
  const clearHref = buildSourceLibraryClearHref(basePath, data.filters);
  const contextChips = buildSourceContextChips(data.filters);

  return (
    <section className="space-y-8 md:space-y-10">
      <PageHeader
        className="gap-6"
        description="这里不再混着所有来源。进到这一页后，你看到的是同一来源下的一整架内容。"
        eyebrow="Source detail"
        title={sourceContext.label}
      />

      <SourceLibraryToolbar clearHref={clearHref} filters={data.filters} hasActiveFilters={hasActiveFilters} />

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

      <SourceLibraryDetail data={data} source={sourceContext} />
    </section>
  );
}
