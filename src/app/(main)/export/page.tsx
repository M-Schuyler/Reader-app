import type { ReactNode } from "react";
import { ExportCandidateBatchActions } from "@/components/export/export-candidate-batch-actions";
import { MagicWandIcon } from "@/components/icons/magic-wand-icon";
import { getExportOverview } from "@/server/modules/export/export-overview.service";
import { cx } from "@/utils/cx";

export const dynamic = "force-dynamic";

export default async function ExportPage() {
  const overview = await getExportOverview();

  return (
    <section className="space-y-6">
      {/* 统一头部：与 Reading 和 Sources 页面的 Header 逻辑对齐 */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <h1 className="font-ui-heading text-2xl font-bold tracking-tight text-[color:var(--text-primary)]">
            Export
          </h1>
          <div className="h-4 w-px bg-[color:var(--border-subtle)] hidden sm:block" />
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 items-center rounded-full bg-stone-900/5 px-3 text-[13px] font-bold text-[color:var(--text-secondary)] tabular-nums">
              {overview.candidates.length} 待处理
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <StatBadge icon={<StarIcon className="text-amber-500" />} label="Starred" value={overview.starredDocuments} />
          <StatBadge
            icon={<MagicWandIcon className="text-[color:var(--ai-card-accent)]" />}
            label="Summaries"
            value={overview.summarizedDocuments}
          />
          <StatBadge icon={<HighlighterIcon className="text-[color:var(--text-primary)]" />} label="Highlights" value={overview.highlightedDocuments} />
        </div>
      </div>

      <main>
        {overview.candidates.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-[15px] text-[color:var(--text-tertiary)] opacity-60">暂时没有待导出的信号</p>
          </div>
        ) : (
          <ExportCandidateBatchActions candidates={overview.candidates} />
        )}
      </main>
    </section>
  );
}

function StatBadge({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="group/stat relative flex items-center gap-2.5 rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface-soft)] px-4 py-1.5 transition-all hover:border-[color:var(--border-strong)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:translate-y-[-1px]">
      {/* 背景极光微光 */}
      <div className="absolute inset-0 -z-10 rounded-full bg-gradient-to-tr from-transparent via-[color:var(--bg-surface-hover)] to-transparent opacity-0 blur-md transition-opacity duration-500 group-hover/stat:opacity-100" />
      
      <div className="shrink-0 transition-transform duration-500 group-hover/stat:scale-110 group-hover/stat:rotate-[-8deg]">{icon}</div>
      <span className="tabular-nums text-[14px] font-bold text-[color:var(--text-primary)]">{value}</span>
      
      {/* 浮动提示标签 */}
      <span className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-[color:var(--text-primary)] px-3 py-1 text-[9px] font-bold uppercase tracking-[0.15em] text-white opacity-0 transition-all duration-300 translate-y-2 group-hover/stat:opacity-100 group-hover/stat:translate-y-0 shadow-xl">
        {label}
      </span>
    </div>
  );
}

function StarIcon({ className }: { className?: string }) {
  return (
    <svg className={cx("h-4.5 w-4.5 fill-current", className)} viewBox="0 0 24 24">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

function HighlighterIcon({ className }: { className?: string }) {
  return (
    <svg className={cx("h-4.5 w-4.5", className)} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
      <path d="M13.5 3l4 4L7 17.5 3 17.5l0-4L13.5 3z" />
      <path d="M12 4.5l4 4" />
    </svg>
  );
}
