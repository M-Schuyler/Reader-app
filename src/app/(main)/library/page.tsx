import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field, SelectInput, TextInput } from "@/components/ui/form-controls";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { CaptureUrlForm } from "@/components/library/capture-url-form";
import { DocumentList } from "@/components/library/document-list";
import { getDocuments, parseDocumentListQuery } from "@/server/modules/documents/document.service";

export const dynamic = "force-dynamic";

type LibraryPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LibraryPage({ searchParams }: LibraryPageProps) {
  const query = parseDocumentListQuery(await toUrlSearchParams(searchParams));
  const data = await getDocuments(query);
  const hasActiveFilters = Boolean(data.filters.q || (data.filters.sort && data.filters.sort !== "newest"));

  return (
    <section className="space-y-10">
      <PageHeader
        description="A single library for saved articles and captured documents. Quiet enough to scan quickly, stable enough to read deeply."
        eyebrow="Library"
        title="Everything you saved, ready to read."
      />

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
                  Refine what matters.
                </h2>
              </div>

              <Field label="Keyword">
                <TextInput
                  defaultValue={data.filters.q}
                  name="q"
                  placeholder="Search by title or source"
                  type="text"
                />
              </Field>

              <Field label="Sort">
                <SelectInput
                  defaultValue={data.filters.sort}
                  name="sort"
                >
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                  <option value="published">Published</option>
                </SelectInput>
              </Field>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Button className="flex-1" type="submit" variant="primary">
                  Apply
                </Button>
                {hasActiveFilters ? (
                  <Link
                    className="text-sm font-medium text-[color:var(--text-secondary)] transition hover:text-[color:var(--text-primary)]"
                    href="/library"
                  >
                    Reset
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
                <span className="font-medium text-[color:var(--text-primary)]">{data.pagination.total}</span> documents
              </p>
              {data.filters.q ? (
                <p className="text-sm text-[color:var(--text-secondary)]">
                  Matching <span className="font-medium text-[color:var(--text-primary)]">&quot;{data.filters.q}&quot;</span>
                </p>
              ) : null}
            </div>
            <p className="text-sm text-[color:var(--text-tertiary)]">Saved items are grouped in one calm reading flow.</p>
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
