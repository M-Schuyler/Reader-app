import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field, SelectInput, TextInput } from "@/components/ui/form-controls";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { CaptureUrlForm } from "@/components/library/capture-url-form";
import { DocumentList } from "@/components/library/document-list";
import { buildLibraryViewHref, resolveLibraryView, type LibraryViewId } from "@/lib/product-shell";
import { getDocuments, parseDocumentListQuery } from "@/server/modules/documents/document.service";

export const dynamic = "force-dynamic";

type LibraryPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LibraryPage({ searchParams }: LibraryPageProps) {
  const resolvedSearchParams = await toUrlSearchParams(searchParams);
  const query = parseDocumentListQuery(resolvedSearchParams);
  const data = await getDocuments(query);
  const hasActiveFilters = Boolean(data.filters.q || (data.filters.sort && data.filters.sort !== "newest"));
  const activeView = resolveLibraryView(data.filters);
  const activeViewMeta = LIBRARY_VIEWS.find((view) => view.id === activeView) ?? LIBRARY_VIEWS[0];
  const viewItems = LIBRARY_VIEWS.map((view) => ({
    ...view,
    href: buildLibraryViewHref(view.id, resolvedSearchParams),
    isActive: view.id === activeView,
  }));

  return (
    <section className="space-y-10">
      <PageHeader
        description="Collect first, decide depth later. A calm queue keeps signal visible before you commit real reading time."
        eyebrow="Library"
        title="把值得读的内容放进一个安静队列"
      />

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

      <div className="grid gap-8 xl:grid-cols-[22rem_minmax(0,1fr)] xl:items-start">
        <aside className="xl:sticky xl:top-24">
          <Panel className="overflow-hidden" padding="none">
            <div className="border-b border-[color:var(--border-subtle)] px-6 py-6">
              <CaptureUrlForm />
            </div>

            <form className="space-y-5 px-6 py-6" method="GET">
              <div className="space-y-1.5">
                <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[color:var(--text-tertiary)]">
                  Filter
                </p>
                <h2 className="font-display text-[1.6rem] leading-tight tracking-[-0.02em] text-[color:var(--text-primary)]">
                  筛选当前文档库
                </h2>
              </div>

              <Field label="关键词">
                <TextInput
                  defaultValue={data.filters.q}
                  name="q"
                  placeholder="搜索标题、摘要或来源"
                  type="text"
                />
              </Field>

              <Field label="排序">
                <SelectInput
                  defaultValue={data.filters.sort}
                  name="sort"
                >
                  <option value="newest">最新收录</option>
                  <option value="oldest">最早收录</option>
                  <option value="published">发布时间</option>
                </SelectInput>
              </Field>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Button className="flex-1" type="submit" variant="primary">
                  应用筛选
                </Button>
                {hasActiveFilters ? (
                  <Link
                    className="text-sm font-medium text-[color:var(--text-secondary)] transition hover:text-[color:var(--text-primary)]"
                    href="/library"
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
                当前共有 <span className="font-medium text-[color:var(--text-primary)]">{data.pagination.total}</span> 篇文档
                <span className="ml-1 font-medium text-[color:var(--text-primary)]">· {activeViewMeta.label}</span>
              </p>
              {data.filters.q ? (
                <p className="text-sm text-[color:var(--text-secondary)]">
                  搜索 <span className="font-medium text-[color:var(--text-primary)]">&quot;{data.filters.q}&quot;</span>
                </p>
              ) : null}
            </div>
            <p className="max-w-xl text-sm text-[color:var(--text-tertiary)]">{activeViewMeta.description}</p>
          </div>

          <DocumentList data={data} />
        </div>
      </div>
    </section>
  );
}

async function toUrlSearchParams(
  input: LibraryPageProps["searchParams"],
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

const LIBRARY_VIEWS: Array<{ id: LibraryViewId; label: string; description: string }> = [
  {
    id: "inbox",
    label: "文档库",
    description: "Everything you saved, ready for triage before it turns into deliberate reading.",
  },
  {
    id: "later",
    label: "稍后读",
    description: "Pieces worth coming back to when you have a slower and more focused reading session.",
  },
  {
    id: "starred",
    label: "收藏",
    description: "Documents kept close because they deserve a faster return and a shorter path back in.",
  },
  {
    id: "archive",
    label: "归档",
    description: "Reading that has been absorbed, but still belongs in the library as lasting reference.",
  },
];
