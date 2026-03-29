"use client";

import Link from "next/link";
import { Panel } from "@/components/ui/panel";
import type { GetDocumentsResponseData } from "@/server/modules/documents/document.types";
import type { SourceLibrarySourceContext } from "@/lib/documents/source-library";
import { SourceLibraryDocumentList } from "./source-library-document-list";
import { getSourceLibraryTone, SourceLibrarySourceCard } from "./source-library-source-card";

type SourceLibraryDetailProps = {
  data: GetDocumentsResponseData;
  source: SourceLibrarySourceContext;
};

export function SourceLibraryDetail({ data, source }: SourceLibraryDetailProps) {
  const latestLabel = formatCollectedAt(source.latestCreatedAt);
  const visibleTotal = data.pagination.total;

  return (
    <section className="space-y-6">
      <Link
        className="inline-flex items-center gap-2 text-sm text-[color:var(--text-secondary)] transition hover:text-[color:var(--text-primary)]"
        href="/sources"
      >
        <span aria-hidden="true">←</span>
        <span>返回来源库</span>
      </Link>

      <div className="grid gap-5 lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-stretch">
        <SourceLibrarySourceCard
          host={source.host}
          href={null}
          kind={source.kind}
          label={source.label}
          latestLabel={latestLabel}
          meta={source.meta}
          tone={getSourceLibraryTone(0)}
          variant="hero"
        />

        <Panel className="flex h-full flex-col justify-between gap-5 rounded-[32px] border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] px-6 py-6" tone="muted">
          <div className="space-y-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[color:var(--text-tertiary)]">Source detail</p>
            <div className="space-y-2">
              <h2 className="font-ui-heading text-[2.4rem] leading-[0.96] tracking-[-0.05em] text-[color:var(--text-primary)]">
                {source.label}
              </h2>
              <p className="max-w-2xl text-[15px] leading-7 text-[color:var(--text-secondary)]">
                这个来源下共有 {source.totalItems} 篇内容。当前筛选下能看到 {visibleTotal} 篇，保留同一来源的阅读脉络，不再被总书架打散。
              </p>
            </div>
          </div>

          <div className="grid gap-3 border-t border-[color:var(--border-subtle)] pt-4 sm:grid-cols-3">
            <Metric label="来源类型" value={formatKind(source.kind)} />
            <Metric label="篇数" value={source.meta} />
            <Metric label="最近收入库" value={latestLabel} />
          </div>
        </Panel>
      </div>

      {data.items.length > 0 ? (
        <SourceLibraryDocumentList items={data.items} toneIndex={0} />
      ) : (
        <Panel className="px-8 py-12 text-center" tone="muted">
          <div className="mx-auto max-w-lg space-y-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[color:var(--text-tertiary)]">Source detail</p>
            <h3 className="font-ui-heading text-[2rem] leading-tight tracking-[-0.04em] text-[color:var(--text-primary)]">
              这个来源下暂时没有符合当前筛选的内容
            </h3>
            <p className="text-sm leading-7 text-[color:var(--text-secondary)]">
              来源还在，只是当前关键词或类型把结果收窄了。你可以清空筛选，再回来看这一架完整的内容。
            </p>
          </div>
        </Panel>
      )}
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[color:var(--text-tertiary)]">{label}</p>
      <p className="text-sm text-[color:var(--text-secondary)]">{value}</p>
    </div>
  );
}

function formatKind(kind: SourceLibrarySourceContext["kind"]) {
  switch (kind) {
    case "feed":
      return "Feed";
    case "domain":
      return "Web Source";
    case "unknown":
    default:
      return "Collected";
  }
}

function formatCollectedAt(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
  }).format(new Date(value));
}
