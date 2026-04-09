"use client";

import Link from "next/link";
import { Panel } from "@/components/ui/panel";
import type { GetSourceLibraryIndexResponseData, SourceLibraryIndexGroup } from "@/server/modules/documents/document.types";
import { getSourceLibraryToneForSeed, SourceLibrarySourceCard } from "./source-library-source-card";

type SourceLibraryIndexProps = {
  data: GetSourceLibraryIndexResponseData;
  allDocumentsHref: string;
};

export function SourceLibraryIndex({ data, allDocumentsHref }: SourceLibraryIndexProps) {
  if (data.emptyState === "empty_library") {
    return (
      <Panel className="px-8 py-12 text-center" tone="muted">
        <div className="mx-auto max-w-lg space-y-3">
          <h2 className="font-ui-heading text-[2.2rem] leading-tight tracking-[-0.04em] text-[color:var(--text-primary)]">
            来源库还没有内容
          </h2>
          <p className="text-sm leading-7 text-[color:var(--text-secondary)]">先收进第一篇，再从这里走进具体来源。</p>
        </div>
      </Panel>
    );
  }

  if (data.emptyState === "no_recent_sources") {
    return (
      <Panel className="px-8 py-12 text-center" tone="muted">
        <div className="mx-auto max-w-lg space-y-3">
          <h2 className="font-ui-heading text-[2.2rem] leading-tight tracking-[-0.04em] text-[color:var(--text-primary)]">
            最近 7 天没有新来源
          </h2>
          <p className="text-sm leading-7 text-[color:var(--text-secondary)]">
            库里还有更早的内容，只是最近 7 天没有新的来源进入。完整文档流仍然可以从“显示全部文档”进入。
          </p>
          <div className="pt-2">
            <Link
              className="text-sm text-[color:var(--text-tertiary)] transition hover:text-[color:var(--text-secondary)]"
              href={allDocumentsHref}
            >
              显示全部文档 →
            </Link>
          </div>
        </div>
      </Panel>
    );
  }

  return <SourceLibraryRecentShelf allDocumentsHref={allDocumentsHref} groups={data.groups} />;
}

function SourceLibraryRecentShelf({
  groups,
  allDocumentsHref,
}: {
  groups: SourceLibraryIndexGroup[];
  allDocumentsHref: string;
}) {
  const totalItems = groups.reduce((count, group) => count + group.totalItems, 0);

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 border-b border-[color:var(--border-subtle)] pb-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-ui-heading text-[1.45rem] leading-tight tracking-[-0.03em] text-[color:var(--text-primary)]">
            最近 7 天
          </h2>
          <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-[color:var(--text-tertiary)]">
            Recent 7 days
          </span>
        </div>

        <div className="flex items-center gap-4">
          <p className="text-sm text-[color:var(--text-tertiary)]">
            {groups.length} 个来源 · {totalItems} 篇
          </p>
          <Link
            className="text-sm text-[color:var(--text-tertiary)] transition hover:text-[color:var(--text-secondary)]"
            href={allDocumentsHref}
          >
            显示全部文档 →
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-[repeat(auto-fit,minmax(15rem,1fr))]">
        {groups.map((group) => (
          <SourceLibraryIndexCard group={group} key={group.id} />
        ))}
      </div>
    </section>
  );
}

function SourceLibraryIndexCard({ group }: { group: SourceLibraryIndexGroup }) {
  return (
    <SourceLibrarySourceCard
      filterSummary={group.filterSummary}
      host={group.host}
      href={group.href}
      kind={group.kind}
      label={group.label}
      latestLabel={group.latestCreatedAt ? formatCollectedAt(group.latestCreatedAt) : null}
      meta={group.meta}
      tone={getSourceLibraryToneForSeed(group.id)}
      variant="index"
    />
  );
}

function formatCollectedAt(value: string) {
  return `最近收入库 ${new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
  }).format(new Date(value))}`;
}
