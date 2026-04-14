import Link from "next/link";
import { DocumentList } from "@/components/library/document-list";
import { SourceLibraryToolbar } from "@/components/library/source-library-toolbar";
import { Panel } from "@/components/ui/panel";
import {
  buildSourceContextChips,
  buildSourceLibraryBrowseHref,
  buildSourceLibraryClearHref,
  parseSourceLibraryQuery,
  resolveSourceSearchParams,
} from "@/lib/documents/source-library-query";
import { getDocuments } from "@/server/modules/documents/document.service";

export const dynamic = "force-dynamic";

type SourceAllDocumentsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SourceAllDocumentsPage({ searchParams }: SourceAllDocumentsPageProps) {
  const resolvedSearchParams = await resolveSourceSearchParams(searchParams);
  const parsedQuery = parseSourceLibraryQuery(resolvedSearchParams);
  const data = await getDocuments({
    ...parsedQuery,
    surface: "source",
  });
  const hasActiveFilters = Boolean(data.filters.q || data.filters.type || data.filters.tag || data.filters.sort !== "latest");
  const backHref = buildSourceLibraryBrowseHref("/sources", {
    ...parsedQuery,
    surface: "source",
  });
  const clearHref = buildSourceLibraryClearHref("/sources/all", data.filters);
  const contextChips = buildSourceContextChips(data.filters, undefined, { sortContext: "documentList" });
  const hasPreviousPage = data.pagination.page > 1;
  const hasNextPage = data.pagination.page < data.pagination.totalPages;

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
          <h1 className="font-ui-heading text-xl font-bold tracking-tight text-[color:var(--text-primary)]">
            全部文档
          </h1>
          <span className="inline-flex h-6 items-center rounded-full bg-stone-900/5 px-2 text-[11px] font-bold text-[color:var(--text-tertiary)]">
            {data.pagination.total} 篇
          </span>
        </div>

        <SourceLibraryToolbar
          clearHref={clearHref}
          filters={data.filters}
          hasActiveFilters={hasActiveFilters}
          showFilters
          sortContext="documentList"
        />
      </div>

      {contextChips.length > 0 ? (
        <Panel
          className="flex flex-col gap-3 rounded-[28px] border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
          tone="muted"
        >
          <p className="text-sm text-[color:var(--text-secondary)]">当前正在完整文档流里查看筛选后的结果。</p>
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

      {data.items.length > 0 ? (
        <DocumentList data={data} showDelete={true} />
      ) : (
        <Panel className="px-8 py-12 text-center" tone="muted">
          <div className="mx-auto max-w-lg space-y-3">
            <h2 className="font-ui-heading text-[2rem] leading-tight tracking-[-0.04em] text-[color:var(--text-primary)]">
              当前筛选下没有文档
            </h2>
            <p className="text-sm leading-7 text-[color:var(--text-secondary)]">
              来源库里还有内容，只是当前关键词或类型把完整文档流收窄了。
            </p>
          </div>
        </Panel>
      )}

      <nav className="flex items-center justify-between gap-3 border-t border-[color:var(--border-subtle)] pt-4">
        {hasPreviousPage ? (
          <Link
            className="inline-flex min-h-10 items-center rounded-full border border-[color:var(--border-subtle)] px-4 text-sm text-[color:var(--text-secondary)] transition hover:border-[color:var(--border-strong)] hover:text-[color:var(--text-primary)]"
            href={buildSourceAllPageHref(parsedQuery, data.pagination.page - 1)}
          >
            上一页
          </Link>
        ) : (
          <span className="inline-flex min-h-10 items-center rounded-full border border-[color:var(--border-subtle)] px-4 text-sm text-[color:var(--text-tertiary)]">
            上一页
          </span>
        )}

        <span className="text-sm text-[color:var(--text-secondary)]">{data.pagination.total} 篇</span>

        {hasNextPage ? (
          <Link
            className="inline-flex min-h-10 items-center rounded-full border border-[color:var(--border-subtle)] px-4 text-sm text-[color:var(--text-secondary)] transition hover:border-[color:var(--border-strong)] hover:text-[color:var(--text-primary)]"
            href={buildSourceAllPageHref(parsedQuery, data.pagination.page + 1)}
          >
            下一页
          </Link>
        ) : (
          <span className="inline-flex min-h-10 items-center rounded-full border border-[color:var(--border-subtle)] px-4 text-sm text-[color:var(--text-tertiary)]">
            下一页
          </span>
        )}
      </nav>
    </section>
  );
}

function buildSourceAllPageHref(
  query: ReturnType<typeof parseSourceLibraryQuery>,
  page: number,
) {
  const baseHref = buildSourceLibraryBrowseHref("/sources/all", {
    ...query,
    surface: "source",
  });

  if (page <= 1) {
    return baseHref;
  }

  const separator = baseHref.includes("?") ? "&" : "?";
  return `${baseHref}${separator}page=${page}`;
}
