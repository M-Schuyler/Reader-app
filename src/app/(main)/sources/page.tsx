import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field, SelectInput } from "@/components/ui/form-controls";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { CaptureUrlForm } from "@/components/library/capture-url-form";
import { DocumentList } from "@/components/library/document-list";
import { getDocuments, parseDocumentListQuery } from "@/server/modules/documents/document.service";

export const dynamic = "force-dynamic";

type SourcesPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SourcesPage({ searchParams }: SourcesPageProps) {
  const resolvedSearchParams = await toUrlSearchParams(searchParams);
  const parsedQuery = parseDocumentListQuery(resolvedSearchParams);
  const data = await getDocuments({
    ...parsedQuery,
    surface: "source",
  });
  const hasActiveFilters = Boolean(data.filters.q || data.filters.type || data.filters.sort !== "latest");

  return (
    <section className="space-y-10">
      <PageHeader
        description="Everything you import or collect lands here first. Start reading only when a piece proves it deserves attention."
        eyebrow="Sources"
        title="来源库"
      />

      <div className="grid gap-8 xl:grid-cols-[22rem_minmax(0,1fr)] xl:items-start">
        <aside className="space-y-6 xl:sticky xl:top-24">
          <Panel className="overflow-hidden" padding="none">
            <div className="border-b border-[color:var(--border-subtle)] px-6 py-6">
              <CaptureUrlForm />
            </div>

            <form className="space-y-5 px-6 py-6" method="GET">
              {data.filters.q ? <input name="q" type="hidden" value={data.filters.q} /> : null}
              <div className="space-y-1.5">
                <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[color:var(--text-tertiary)]">
                  Source filters
                </p>
                <h2 className="font-ui-heading text-[1.6rem] leading-tight tracking-[-0.02em] text-[color:var(--text-primary)]">
                  只在来源库里继续筛选
                </h2>
              </div>

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
                    href={data.filters.q ? `/sources?q=${encodeURIComponent(data.filters.q)}` : "/sources"}
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
                当前共有 <span className="font-medium text-[color:var(--text-primary)]">{data.pagination.total}</span> 篇来源文章
              </p>
              {data.filters.q ? (
                <p className="text-sm text-[color:var(--text-secondary)]">
                  搜索 <span className="font-medium text-[color:var(--text-primary)]">&quot;{data.filters.q}&quot;</span>
                </p>
              ) : null}
            </div>
            <p className="max-w-xl text-sm text-[color:var(--text-tertiary)]">
              这是全量来源面。它保存所有输入，不要求你立刻进入阅读。
            </p>
          </div>

          <DocumentList
            data={data}
            emptyState={{
              eyebrow: "Sources",
              title: "来源库还没有内容",
              description: "先导入网页、自动收集文章，再从中挑真正值得开始阅读的内容。",
            }}
          />
        </div>
      </div>
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
