import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { SourceLibrary } from "@/components/library/source-library";
import { SourceLibraryToolbar } from "@/components/library/source-library-toolbar";
import { parseSourceLibraryQuery } from "@/lib/documents/source-library-query";
import type { GetDocumentsResponseData } from "@/server/modules/documents/document.types";
import { getDocuments } from "@/server/modules/documents/document.service";

export const dynamic = "force-dynamic";

type SourcesPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SourcesPage({ searchParams }: SourcesPageProps) {
  const resolvedSearchParams = await toUrlSearchParams(searchParams);
  const parsedQuery = parseSourceLibraryQuery(resolvedSearchParams);
  const data = await getDocuments({
    ...parsedQuery,
    surface: "source",
  });
  const hasActiveFilters = Boolean(data.filters.q || data.filters.type || data.filters.sort !== "latest");
  const clearHref = data.filters.q ? `/sources?q=${encodeURIComponent(data.filters.q)}` : "/sources";
  const contextChips = buildSourceContextChips(data.filters);

  return (
    <section className="space-y-8 md:space-y-10">
      <PageHeader
        className="gap-6"
        description="所有新收进来的内容先停在这里。它们不需要立刻进入 Reading，先安静排上书架就好。"
        eyebrow="Source Library"
        title="来源库"
      />

      <SourceLibraryToolbar clearHref={clearHref} filters={data.filters} hasActiveFilters={hasActiveFilters} />

      <Panel className="flex flex-col gap-3 rounded-[28px] border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] px-5 py-4 sm:flex-row sm:items-center sm:justify-between" tone="muted">
        <div className="space-y-1">
          <p className="text-sm text-[color:var(--text-secondary)]">
            当前共有 <span className="font-medium text-[color:var(--text-primary)]">{data.pagination.total}</span> 篇内容停在来源库里
          </p>
          <p className="text-sm text-[color:var(--text-tertiary)]">
            它们先按收入库的时间排成书架，等你判断哪些值得真正开始读。
          </p>
        </div>

        {contextChips.length > 0 ? (
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
        ) : null}
      </Panel>

      <SourceLibrary data={data} />
    </section>
  );
}

async function toUrlSearchParams(
  input: SourcesPageProps["searchParams"],
): Promise<URLSearchParams> {
  const resolved = await (input ?? Promise.resolve({}));
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(resolved)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string") {
          searchParams.append(key, item);
        }
      }
      continue;
    }

    if (typeof value === "string") {
      searchParams.set(key, value);
    }
  }

  return searchParams;
}

function buildSourceContextChips(filters: GetDocumentsResponseData["filters"]) {
  const chips: string[] = [];

  if (filters.q) {
    chips.push(`搜索 “${filters.q}”`);
  }

  if (filters.type) {
    chips.push(`类型 ${formatDocumentType(filters.type)}`);
  }

  if (filters.sort === "earliest") {
    chips.push("最早收进来优先");
  }

  return chips;
}

function formatDocumentType(value: string) {
  switch (value) {
    case "WEB_PAGE":
      return "网页";
    case "RSS_ITEM":
      return "RSS";
    case "PDF":
      return "PDF";
    default:
      return value;
  }
}
