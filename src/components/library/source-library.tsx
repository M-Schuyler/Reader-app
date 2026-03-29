"use client";

import { Panel } from "@/components/ui/panel";
import {
  type SourceAliasMap,
  buildSourceShelfSections,
  type SourceLibrarySourceGroup,
  type SourceShelfSection,
} from "@/lib/documents/source-library";
import type { GetDocumentsResponseData } from "@/server/modules/documents/document.types";
import { getSourceLibraryToneForSeed, SourceLibrarySourceCard } from "./source-library-source-card";

type SourceLibraryIndexProps = {
  data: GetDocumentsResponseData;
  aliasMap?: SourceAliasMap;
};

export function SourceLibraryIndex({ data, aliasMap }: SourceLibraryIndexProps) {
  const sections = buildSourceShelfSections(data.items, new Date(), aliasMap);

  if (sections.length === 0) {
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

  return (
    <div className="space-y-8">
      {sections.map((section) => (
        <SourceLibraryShelf key={section.key} section={section} />
      ))}
    </div>
  );
}

function SourceLibraryShelf({ section }: { section: SourceShelfSection }) {
  const totalItems = section.groups.reduce((count, group) => count + group.items.length, 0);

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-2 border-b border-[color:var(--border-subtle)] pb-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-ui-heading text-[1.45rem] leading-tight tracking-[-0.03em] text-[color:var(--text-primary)]">
            {section.label}
          </h2>
          <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-[color:var(--text-tertiary)]">
            {section.description}
          </span>
        </div>

        <p className="text-sm text-[color:var(--text-tertiary)]">
          {section.groups.length} 个来源 · {totalItems} 篇
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-[repeat(auto-fit,minmax(15rem,1fr))]">
        {section.groups.map((group) => (
          <SourceLibraryIndexCard group={group} key={group.id} />
        ))}
      </div>
    </section>
  );
}

function SourceLibraryIndexCard({ group }: { group: SourceLibrarySourceGroup }) {
  return (
    <SourceLibrarySourceCard
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
