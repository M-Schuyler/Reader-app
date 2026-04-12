import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field, SelectInput } from "@/components/ui/form-controls";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { DocumentList } from "@/components/library/document-list";
import { buildReadingViewHref, resolveReadingView, type ReadingViewId } from "@/lib/product-shell";
import { getDocuments, parseDocumentListQuery } from "@/server/modules/documents/document.service";

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
    <section className="space-y-10">
      <PageHeader eyebrow="Reading" title="Reading" />

      <div className="flex flex-wrap gap-2">
        {viewItems.map((view) => (
          <Link
            className={
              view.isActive
                ? "inline-flex min-h-10 items-center rounded-full border border-[color:var(--border-strong)] bg-[color:var(--bg-surface-soft)] px-4 text-sm font-medium text-[color:var(--text-primary)] transition"
                : "inline-flex min-h-10 items-center rounded-full border border-[color:var(--border-subtle)] bg-transparent px-4 text-sm font-medium text-[color:var(--text-secondary)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--bg-surface-soft)] hover:text-[color:var(--text-primary)]"
            }
            href={view.href}
            key={view.id}
          >
            {view.label}
          </Link>
        ))}
      </div>

      <div className="grid gap-8 xl:grid-cols-[18rem_minmax(0,1fr)] xl:items-start">
        <aside className="xl:sticky xl:top-24">
          <Panel className="space-y-5">
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[color:var(--text-tertiary)]">
                Reading filters
              </p>
              <h2 className="font-ui-heading text-[1.6rem] leading-tight tracking-[-0.02em] text-[color:var(--text-primary)]">
                保持队列清晰
              </h2>
            </div>

            <form className="space-y-5" method="GET">
              {data.filters.q ? <input name="q" type="hidden" value={data.filters.q} /> : null}
              {data.filters.tag ? <input name="tag" type="hidden" value={data.filters.tag} /> : null}
              <Field label="文档类型">
                <SelectInput defaultValue={data.filters.type ?? ""} name="type">
                  <option value="">全部类型</option>
                  <option value="WEB_PAGE">网页</option>
                  <option value="RSS_ITEM">RSS</option>
                  <option value="PDF">PDF</option>
                </SelectInput>
              </Field>

              <Field label="排序">
                <SelectInput defaultValue={data.filters.sort} name="sort">
                  <option value="latest">最新发布</option>
                  <option value="earliest">最早发布</option>
                </SelectInput>
              </Field>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Button className="flex-1" type="submit" variant="primary">
                  应用筛选
                </Button>
                {hasActiveFilters ? (
                  <Link
                    className="text-sm font-medium text-[color:var(--text-secondary)] transition hover:text-[color:var(--text-primary)]"
                    href={clearHref}
                  >
                    清空
                  </Link>
                ) : null}
              </div>
            </form>
          </Panel>
        </aside>

        <div className="space-y-5">
          <div className="flex flex-col gap-3 px-1 sm:flex-row sm:items-end sm:justify-between">
            <div className="space-y-1">
              <p className="text-sm text-[color:var(--text-secondary)]">
                当前共有 <span className="font-medium text-[color:var(--text-primary)]">{data.pagination.total}</span> 篇文档处于 Reading
                <span className="ml-1 font-medium text-[color:var(--text-primary)]">· {activeViewMeta.label}</span>
              </p>
              {activeFilterChips.length > 0 ? (
                <div className="flex flex-wrap gap-2 pt-2">
                  {activeFilterChips.map((chip) => (
                    <span
                      className="inline-flex min-h-8 items-center rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface-soft)] px-3 text-sm text-[color:var(--text-secondary)]"
                      key={chip}
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
            <p className="max-w-xl text-sm text-[color:var(--text-tertiary)]">{activeViewMeta.description}</p>
          </div>

          <DocumentList
            data={data}
            emptyState={{
              eyebrow: "Reading",
              title: "Reading 还没有内容",
              description: "先从来源库打开一篇文章，它就会进入这里，形成真正的预读队列。",
            }}
          />
        </div>
      </div>
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
