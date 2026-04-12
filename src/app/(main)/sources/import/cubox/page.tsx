import Link from "next/link";
import { CuboxImportForm } from "@/components/library/cubox-import-form";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/ui/panel";

export default function CuboxImportPage() {
  return (
    <section className="space-y-8">
      <PageHeader
        eyebrow="Import"
        title="导入 Cubox"
      />

      <CuboxImportForm />

      <Panel className="space-y-4" tone="muted">
        <h2 className="font-ui-heading text-[1.4rem] leading-tight tracking-[-0.03em] text-[color:var(--text-primary)]">
          这轮导入会做什么
        </h2>
        <div className="space-y-2 text-sm leading-7 text-[color:var(--text-secondary)]">
          <p>所有 Cubox 卡片都会按网页文档进入 Reader，不单独造 Cubox 来源。</p>
          <p>标签会保留，folder 会忽略；后面你可以直接点标签筛来源库或 Reading。</p>
          <p>如果 AI 环境已经配好，导入完会自动把这批文档送进摘要队列。</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            className="inline-flex min-h-10 items-center rounded-[18px] border border-[color:var(--border-subtle)] px-4 text-sm font-medium text-[color:var(--text-primary)] transition hover:border-[color:var(--border-strong)]"
            href="/sources"
          >
            返回来源库
          </Link>
        </div>
      </Panel>
    </section>
  );
}
