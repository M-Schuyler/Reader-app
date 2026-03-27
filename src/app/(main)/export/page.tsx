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
        description="Reading leaves a clean package behind. Export keeps it small, structured, and ready for Obsidian."
        eyebrow="Export"
        title="把读完的信号交给下游系统"
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <MetricPanel hint="Starred docs" label="收藏文档" value={String(overview.starredDocuments)} />
        <MetricPanel hint="Summary ready" label="摘要已就绪" value={String(overview.summarizedDocuments)} />
        <MetricPanel hint="Marked docs" label="含高亮文档" value={String(overview.highlightedDocuments)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_22rem]">
        <Panel className="space-y-6">
          <div className="space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[color:var(--text-tertiary)]">
              Queue
            </p>
            <h2 className="font-ui-heading text-[2rem] leading-tight tracking-[-0.04em] text-[color:var(--text-primary)]">
              这些内容已经接近可导出状态
            </h2>
          </div>

          {overview.candidates.length === 0 ? (
            <p className="max-w-2xl text-sm leading-7 text-[color:var(--text-secondary)]">
              还没有适合导出的文档。先收藏内容、等待摘要完成，再积累一些高亮，导出会更完整。
            </p>
          ) : (
            <div className="divide-y divide-[color:var(--border-subtle)]">
              {overview.candidates.map((candidate) => (
                <article className="space-y-3 py-5 first:pt-0 last:pb-0" key={candidate.id}>
                  <div className="flex flex-wrap gap-2 text-[11px] font-medium uppercase tracking-[0.22em] text-[color:var(--text-tertiary)]">
                    {candidate.hasSummary ? <span>摘要已就绪</span> : null}
                    {candidate.isFavorite ? <span>已收藏</span> : null}
                    {candidate.highlightCount > 0 ? <span>{candidate.highlightCount} 条高亮</span> : null}
                  </div>
                  <Link
                    className="block font-ui-heading text-[1.6rem] leading-tight tracking-[-0.04em] text-[color:var(--text-primary)] transition hover:text-[color:var(--text-primary-strong)]"
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
          <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[color:var(--text-tertiary)]">Obsidian</p>
          <p className="text-sm leading-7 text-[color:var(--text-secondary)]">
            导出范围应该刻意收窄，只保留元信息、AI 摘要、高亮、轻量批注和原始链接，不把阅读页噪音一起带走。
          </p>
          <p className="text-sm leading-7 text-[color:var(--text-secondary)]">
            Reader 负责采集与阅读，Obsidian 负责长线整理与结构化沉淀。
          </p>
        </Panel>
      </div>
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

function truncateUrl(value: string | null) {
  if (!value) {
    return "暂无来源链接";
  }

  try {
    const url = new URL(value);
    return `${url.hostname}${url.pathname === "/" ? "" : url.pathname}`;
  } catch {
    return value;
  }
}
