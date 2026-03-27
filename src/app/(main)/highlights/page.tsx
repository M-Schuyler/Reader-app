import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";
import { getHighlightOverview } from "@/server/modules/highlights/highlight-overview.service";

export const dynamic = "force-dynamic";

export default async function HighlightsPage() {
  const overview = await getHighlightOverview();

  return (
    <section className="space-y-10">
      <PageHeader
        description="Highlights are where reading leaves residue. Keep them narrow: capture a passage, add a short note when needed, and revisit only what deserves to travel onward."
        eyebrow="Highlights"
        title="A second pass over what mattered."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricPanel label="Passages saved" value={String(overview.totalHighlights)} />
        <MetricPanel label="Documents marked" value={String(overview.highlightedDocuments)} />
        <Panel className="space-y-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[color:var(--text-tertiary)]">
            Reader boundary
          </p>
          <p className="text-sm leading-7 text-[color:var(--text-secondary)]">
            This page is for revisiting passages, not writing long-form notes. The deeper synthesis belongs downstream.
          </p>
        </Panel>
      </div>

      <Panel className="space-y-6">
        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[color:var(--text-tertiary)]">
            Recent highlights
          </p>
          <h2 className="font-display text-[2rem] leading-tight tracking-[-0.03em] text-[color:var(--text-primary)]">
            Reading traces stay light and easy to revisit.
          </h2>
        </div>

        {overview.recentHighlights.length === 0 ? (
          <div className="space-y-4">
            <p className="max-w-2xl text-sm leading-7 text-[color:var(--text-secondary)]">
              No highlights yet. Once passages start getting marked inside Reader, they will collect here for a quieter
              second pass.
            </p>
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-[20px] border border-transparent bg-[color:var(--text-primary)] px-4.5 text-sm font-medium text-white transition hover:bg-[color:var(--text-primary-strong)]"
              href="/library"
            >
              Return to Library
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-[color:var(--border-subtle)]">
            {overview.recentHighlights.map((highlight) => (
              <article className="space-y-3 py-5 first:pt-0 last:pb-0" key={highlight.id}>
                <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium uppercase tracking-[0.22em] text-[color:var(--text-tertiary)]">
                  <span>{formatDate(highlight.createdAt)}</span>
                  <Link className="transition hover:text-[color:var(--text-primary)]" href={`/documents/${highlight.document.id}`}>
                    {highlight.document.title}
                  </Link>
                </div>
                <blockquote className="max-w-3xl border-l border-[color:var(--border-strong)] pl-4 text-[15px] leading-7 text-[color:var(--text-primary)]">
                  {highlight.quoteText}
                </blockquote>
                {highlight.note ? (
                  <p className="max-w-2xl text-sm leading-7 text-[color:var(--text-secondary)]">{highlight.note}</p>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </Panel>
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

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}
