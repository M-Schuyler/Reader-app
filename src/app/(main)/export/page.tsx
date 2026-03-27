import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { getExportOverview } from "@/server/modules/export/export-overview.service";

export const dynamic = "force-dynamic";

export default async function ExportPage() {
  const overview = await getExportOverview();

  return (
    <section className="space-y-10">
      <PageHeader
        description="Reader is where material gets captured, read, and reduced. Export is the handoff lane for anything that has earned a permanent home in Obsidian."
        eyebrow="Export"
        title="Send the finished signal onward."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricPanel label="Starred documents" value={String(overview.starredDocuments)} />
        <MetricPanel label="Summaries ready" value={String(overview.summarizedDocuments)} />
        <MetricPanel label="Documents with highlights" value={String(overview.highlightedDocuments)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_22rem]">
        <Panel className="space-y-6">
          <div className="space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[color:var(--text-tertiary)]">
              Export queue
            </p>
            <h2 className="font-display text-[2rem] leading-tight tracking-[-0.03em] text-[color:var(--text-primary)]">
              What already looks ready to leave Reader.
            </h2>
          </div>

          {overview.candidates.length === 0 ? (
            <p className="max-w-2xl text-sm leading-7 text-[color:var(--text-secondary)]">
              No documents are ready for export yet. Star items, let summaries finish, and start collecting highlights
              to build a clean downstream handoff.
            </p>
          ) : (
            <div className="divide-y divide-[color:var(--border-subtle)]">
              {overview.candidates.map((candidate) => (
                <article className="space-y-3 py-5 first:pt-0 last:pb-0" key={candidate.id}>
                  <div className="flex flex-wrap gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-[color:var(--text-tertiary)]">
                    {candidate.hasSummary ? <span>Summary ready</span> : null}
                    {candidate.isFavorite ? <span>Starred</span> : null}
                    {candidate.highlightCount > 0 ? <span>{candidate.highlightCount} highlights</span> : null}
                  </div>
                  <Link
                    className="block font-display text-[1.6rem] leading-tight tracking-[-0.03em] text-[color:var(--text-primary)] transition hover:text-[color:var(--text-primary-strong)]"
                    href={`/documents/${candidate.id}`}
                  >
                    {candidate.title}
                  </Link>
                  <p className="text-sm text-[color:var(--text-secondary)]">{truncateUrl(candidate.canonicalUrl ?? candidate.sourceUrl)}</p>
                </article>
              ))}
            </div>
          )}
        </Panel>

        <Panel className="space-y-4" tone="muted">
          <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[color:var(--text-tertiary)]">
            Obsidian boundary
          </p>
          <p className="text-sm leading-7 text-[color:var(--text-secondary)]">
            Export stays narrow on purpose. The downstream package should preserve metadata, AI summary, highlights,
            light notes, and the original source URL, then get out of the way.
          </p>
          <p className="text-sm leading-7 text-[color:var(--text-secondary)]">
            Reader remains the intake and reading surface. Obsidian remains the place for long-form synthesis and
            durable structure.
          </p>
        </Panel>
      </div>
    </section>
  );
}

function MetricPanel({ label, value }: { label: string; value: string }) {
  return (
    <Panel className="space-y-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[color:var(--text-tertiary)]">{label}</p>
      <p className="font-display text-[2.4rem] leading-none tracking-[-0.04em] text-[color:var(--text-primary)]">{value}</p>
    </Panel>
  );
}

function truncateUrl(value: string | null) {
  if (!value) {
    return "No source available";
  }

  try {
    const url = new URL(value);
    return `${url.hostname}${url.pathname === "/" ? "" : url.pathname}`;
  } catch {
    return value;
  }
}
