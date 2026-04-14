import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field, SelectInput } from "@/components/ui/form-controls";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { DocumentList } from "@/components/library/document-list";
import { buildReadingViewHref, resolveReadingView, type ReadingViewId } from "@/lib/product-shell";
import { getDocuments, parseDocumentListQuery } from "@/server/modules/documents/document.service";
import { cx } from "@/utils/cx";

export const dynamic = "force-dynamic";

type ReadingPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ReadingPage({ searchParams }: ReadingPageProps) {
  const resolvedSearchParams = await toUrlSearchParams(searchParams);
  const parsedQuery = parseDocumentListQuery(resolvedSearchParams);
  const data = await getDocuments({
    ...parsedQuery,
    surface: "reading",
  });
  const activeView = resolveReadingView(data.filters);
  const activeViewMeta = READING_VIEWS.find((view) => view.id === activeView) ?? READING_VIEWS[0];
  const hasActiveFilters = Boolean(
    data.filters.type || data.filters.isFavorite || data.filters.readState || data.filters.tag || data.filters.sort !== "latest",
  );
  const viewItems = READING_VIEWS.map((view) => ({
    ...view,
    href: buildReadingViewHref(view.id, resolvedSearchParams),
    isActive: view.id === activeView,
  }));
  const clearHref = buildReadingClearHref(data.filters.q);
  const activeFilterChips = buildReadingFilterChips(data.filters);

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <h1 className="font-ui-heading text-2xl font-bold tracking-tight text-[color:var(--text-primary)]">
            Reading
          </h1>
          <div className="h-4 w-px bg-[color:var(--border-subtle)] hidden sm:block" />
          <nav className="flex items-center gap-1.5">
            {viewItems.map((view) => (
              <Link
                className={cx(
                  "inline-flex h-8 items-center rounded-full px-3 text-[13px] font-medium transition-all duration-200",
                  view.isActive
                    ? "bg-[color:var(--ai-card-accent)] text-white shadow-sm shadow-[color:var(--ai-card-accent)]/20"
                    : "text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-surface-soft)] hover:text-[color:var(--text-primary)]"
                )}
                href={view.href}
                key={view.id}
              >
                {view.label}
                {view.isActive && (
                  <span className="ml-1.5 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-white/20 px-1 text-[10px] font-bold">
                    {data.pagination.total}
                  </span>
                )}
              </Link>
            ))}
          </nav>
        </div>

        {activeFilterChips.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {activeFilterChips.map((chip) => (
              <span
                className="inline-flex h-7 items-center rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface-soft)] px-2.5 text-[11px] font-medium text-[color:var(--text-tertiary)]"
                key={chip}
              >
                {chip}
              </span>
            ))}
            {hasActiveFilters && (
              <Link
                className="inline-flex h-7 items-center px-1 text-[11px] font-bold uppercase tracking-wider text-[color:var(--ai-card-accent)] hover:underline"
                href={clearHref}
              >
                Clear
              </Link>
            )}
          </div>
        )}
      </div>

      <DocumentList
        data={data}
        emptyState={{
          eyebrow: "Reading",
          title: "Reading 还没有内容",
          description: "先从来源库打开一篇文章，它就会进入这里，形成真正的预读队列。",
        }}
      />
    </section>
  );
}

async function toUrlSearchParams(
  input: ReadingPageProps["searchParams"],
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

const READING_VIEWS: Array<{ id: ReadingViewId; label: string; description: string }> = [
  {
    id: "queue",
    label: "当前阅读",
    description: "已经开始读的文档会进入这里，成为真正的预读队列。",
  },
  {
    id: "starred",
    label: "收藏",
    description: "保留靠近手边的文章，缩短下一次回到它的路径。",
  },
  {
    id: "archive",
    label: "已读归档",
    description: "已经读完的内容仍然留在 Reading 体系里，但不再干扰当前队列。",
  },
];

function buildReadingClearHref(q?: string) {
  return q ? `/reading?q=${encodeURIComponent(q)}` : "/reading";
}

function buildReadingFilterChips(
  filters: Awaited<ReturnType<typeof getDocuments>>["filters"],
) {
  const chips: string[] = [];

  if (filters.type) {
    chips.push(`类型 ${formatReadingDocumentType(filters.type)}`);
  }

  if (filters.tag) {
    chips.push(`标签 ${filters.tag}`);
  }

  if (filters.sort === "earliest") {
    chips.push("最早发布优先");
  }

  return chips;
}

function formatReadingDocumentType(value: string) {
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
