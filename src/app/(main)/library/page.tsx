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

  return (
    <section className="space-y-8">
      <div className="space-y-2">
        <p className="text-sm uppercase tracking-[0.25em] text-black/45">Library</p>
        <h2 className="font-serif text-3xl text-black/90">Unified documents, one reading flow.</h2>
        <p className="max-w-3xl text-sm leading-6 text-black/65">
          This page already reads from the document service. For P1, the only ingestion entry is saving a web URL.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-6">
          <CaptureUrlForm />

          <form className="rounded-3xl border border-black/10 bg-white/75 p-5 shadow-sm" method="GET">
            <div className="space-y-4">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-black/45">Search</p>
                <h3 className="mt-2 font-serif text-xl text-black/90">Filter the library</h3>
              </div>

              <label className="block space-y-2 text-sm text-black/70">
                <span>Keyword</span>
                <input
                  className="w-full rounded-2xl border border-black/10 bg-white px-4 py-2.5 outline-none transition focus:border-black/30"
                  defaultValue={data.filters.q}
                  name="q"
                  placeholder="title or URL"
                  type="text"
                />
              </label>

              <label className="block space-y-2 text-sm text-black/70">
                <span>Sort</span>
                <select
                  className="w-full rounded-2xl border border-black/10 bg-white px-4 py-2.5 outline-none transition focus:border-black/30"
                  defaultValue={data.filters.sort}
                  name="sort"
                >
                  <option value="newest">Newest</option>
                  <option value="oldest">Oldest</option>
                  <option value="published">Published</option>
                </select>
              </label>

              <button
                className="w-full rounded-2xl bg-stone-900 px-4 py-2.5 text-sm font-medium text-stone-50 transition hover:bg-stone-800"
                type="submit"
              >
                Apply filters
              </button>
            </div>
          </form>
        </aside>

        <div className="space-y-4">
          <div className="rounded-3xl border border-black/10 bg-white/75 px-5 py-4 shadow-sm">
            <p className="text-sm text-black/65">
              <span className="font-medium text-black/90">{data.pagination.total}</span> documents
              {data.filters.q ? (
                <>
                  {" "}
                  matching <span className="font-medium text-black/90">&quot;{data.filters.q}&quot;</span>
                </>
              ) : null}
            </p>
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
