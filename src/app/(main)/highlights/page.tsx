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
        description="Keep the residue light. Save the line, leave a short note, come back only when it still matters."
        eyebrow="Highlights"
        title="把真正重要的句子留下来"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricPanel hint="Saved passages" label="已保存高亮" value={String(overview.totalHighlights)} />
        <MetricPanel hint="Marked documents" label="涉及文档" value={String(overview.highlightedDocuments)} />
        <Panel className="space-y-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[color:var(--text-tertiary)]">
            Reader
          </p>
          <p className="text-sm leading-7 text-[color:var(--text-secondary)]">
            这里适合回看重点，不适合写长文式整理。更深的沉淀留给下游笔记系统。
          </p>
        </Panel>
      </div>

      <Panel className="space-y-6">
        <div className="space-y-2">
          <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[color:var(--text-tertiary)]">
            Recent
          </p>
          <h2 className="font-ui-heading text-[2rem] leading-tight tracking-[-0.04em] text-[color:var(--text-primary)]">
            最近高亮，适合快速回看
          </h2>
        </div>

        {overview.recentHighlights.length === 0 ? (
          <div className="space-y-4">
            <p className="max-w-2xl text-sm leading-7 text-[color:var(--text-secondary)]">
              还没有高亮。等你在阅读页开始标记句子，这里会慢慢形成一条轻量的回看轨迹。
            </p>
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-[20px] border border-transparent bg-[color:var(--button-primary-bg)] px-4.5 text-sm font-medium text-[color:var(--button-primary-text)] transition hover:bg-[color:var(--button-primary-hover-bg)]"
              href="/reading"
            >
              返回 Reading
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

function MetricPanel({ hint, label, value }: { hint: string; label: string; value: string }) {
  return (
    <Panel className="space-y-3">
      <div className="space-y-1">
        <p className="text-[11px] font-medium text-[color:var(--text-primary)]">{label}</p>
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[color:var(--text-tertiary)]">{hint}</p>
      </div>
      <p className="font-display text-[2.4rem] leading-none tracking-[-0.04em] text-[color:var(--text-primary)]">{value}</p>
    </Panel>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}
