"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { IngestionJobStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/ui/form-controls";
import { Panel } from "@/components/ui/panel";
import type { GetDocumentsResponseData } from "@/server/modules/documents/document.types";
import type { SourceLibrarySourceContext } from "@/lib/documents/source-library";
import { SourceLibraryDocumentList } from "./source-library-document-list";
import { SourceLibraryDetailFilters } from "./source-library-detail-filters";
import { getSourceLibraryToneForSeed, SourceLibrarySourceCard } from "./source-library-source-card";

type SourceLibraryDetailProps = {
  data: GetDocumentsResponseData;
  source: SourceLibrarySourceContext;
  backHref?: string;
  clearHref?: string;
  hasActiveFilters?: boolean;
  includeCategories?: string[];
  sync?: {
    sourceId: string;
    lastSyncedAt: string | null;
    lastSyncStatus: IngestionJobStatus | null;
    lastSyncError: string | null;
  };
};

export function SourceLibraryDetail({
  backHref = "/sources",
  clearHref = "/sources",
  data,
  hasActiveFilters = false,
  source,
  includeCategories = [],
  sync,
}: SourceLibraryDetailProps) {
  const latestLabel = formatCollectedAt(source.latestCreatedAt);
  const visibleTotal = data.pagination.total;
  const tone = getSourceLibraryToneForSeed(source.id);

  return (
    <section className="space-y-6">
      <Link
        className="inline-flex items-center gap-2 text-sm text-[color:var(--text-secondary)] transition hover:text-[color:var(--text-primary)]"
        href={backHref}
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
          tone={tone}
          variant="hero"
        />

        <Panel className="flex h-full flex-col justify-between gap-5 rounded-[32px] border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] px-6 py-6" tone="muted">
          <div className="space-y-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[color:var(--text-tertiary)]">Source detail</p>
            <div className="space-y-2">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <h2 className="max-w-full font-ui-heading text-[clamp(2rem,4.4vw,3.1rem)] leading-[0.96] tracking-[-0.05em] text-[color:var(--text-primary)] [overflow-wrap:anywhere]">
                    {source.label}
                  </h2>
                  {source.customLabel ? (
                    <p className="text-sm text-[color:var(--text-tertiary)] [overflow-wrap:anywhere]">{source.defaultLabel}</p>
                  ) : null}
                </div>

                <div className="flex flex-col items-start gap-3">
                  {sync ? <SourceSyncButton sourceId={sync.sourceId} /> : null}
                  <SourceAliasEditor source={source} />
                </div>
              </div>
              <p className="max-w-2xl text-[15px] leading-7 text-[color:var(--text-secondary)]">
                这个来源下共有 {source.totalItems} 篇内容。当前筛选下能看到 {visibleTotal} 篇，保留同一来源的阅读脉络，不再被总书架打散。
              </p>
              {includeCategories.length > 0 ? (
                <div className="space-y-2 pt-2">
                  <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[color:var(--text-tertiary)]">分类过滤</p>
                  <p className="text-sm text-[color:var(--text-secondary)]">当前来源同步时只会保留这些分类，避免把整条 feed 的内容一股脑收进来。</p>
                  <div className="flex flex-wrap gap-2">
                    {includeCategories.map((category) => (
                      <span
                        className="inline-flex min-h-8 items-center rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface-soft)] px-3 text-sm text-[color:var(--text-secondary)]"
                        key={category}
                      >
                        {category}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3 border-t border-[color:var(--border-subtle)] pt-4 sm:grid-cols-4">
            <Metric label="来源类型" value={formatKind(source.kind)} />
            <Metric label="篇数" value={source.meta} />
            <Metric label="最近收入库" value={latestLabel} />
            {sync ? <Metric label="同步状态" value={formatSyncMeta(sync.lastSyncStatus, sync.lastSyncedAt)} /> : null}
          </div>

          {sync?.lastSyncError ? <p className="text-sm text-[color:var(--badge-danger-text)]">{sync.lastSyncError}</p> : null}
        </Panel>
      </div>

      <SourceLibraryDetailFilters
        clearHref={clearHref}
        contentOrigin={data.contentOrigin}
        filters={data.filters}
        hasActiveFilters={hasActiveFilters}
      />

      {data.items.length > 0 ? (
        <SourceLibraryDocumentList emptyRedirectHref="/sources" items={data.items} sourceTotalItems={source.totalItems} toneSeed={source.id} />
      ) : (
        <Panel className="px-8 py-12 text-center" tone="muted">
          <div className="mx-auto max-w-lg space-y-3">
            <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[color:var(--text-tertiary)]">Source detail</p>
            <h3 className="font-ui-heading text-[2rem] leading-tight tracking-[-0.04em] text-[color:var(--text-primary)]">
              这个来源下暂时没有符合当前筛选的内容
            </h3>
            <p className="text-sm leading-7 text-[color:var(--text-secondary)]">
              来源还在，只是当前筛选条件把结果收窄了。你可以清空筛选，再回来看这一架完整的内容。
            </p>
          </div>
        </Panel>
      )}
    </section>
  );
}

function SourceAliasEditor({ source }: { source: SourceLibrarySourceContext }) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(source.customLabel ?? source.label);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (source.kind === "unknown" || source.kind === "source" || !source.value) {
    return null;
  }

  async function submitAlias(nextName: string | null) {
    setError(null);

    try {
      const response = await fetch("/api/sources/alias", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          kind: source.kind,
          value: source.value,
          name: nextName,
        }),
      });

      const payload = (await response.json()) as
        | { ok: true }
        | {
            ok: false;
            error: {
              message: string;
            };
          };

      if (!payload.ok) {
        setError(payload.error.message);
        return;
      }

      setIsEditing(false);
      startTransition(() => {
        router.refresh();
      });
    } catch {
      setError("保存书架名称失败，请稍后再试。");
    }
  }

  return (
    <div className="space-y-2 lg:max-w-[17rem]">
      {isEditing ? (
        <>
          <TextInput
            className="min-h-10 rounded-[16px]"
            onChange={(event) => setValue(event.target.value)}
            value={value}
          />
          <div className="flex flex-wrap gap-2">
            <Button disabled={isPending} onClick={() => submitAlias(value)} size="sm" variant="primary">
              {isPending ? "保存中…" : "保存名称"}
            </Button>
            {source.customLabel ? (
              <Button disabled={isPending} onClick={() => submitAlias(null)} size="sm" variant="secondary">
                恢复默认
              </Button>
            ) : null}
            <Button
              disabled={isPending}
              onClick={() => {
                setError(null);
                setIsEditing(false);
                setValue(source.customLabel ?? source.label);
              }}
              size="sm"
              variant="quiet"
            >
              取消
            </Button>
          </div>
          {error ? <p className="text-sm text-[color:var(--badge-danger-text)]">{error}</p> : null}
        </>
      ) : (
        <div className="space-y-2">
          <Button onClick={() => setIsEditing(true)} size="sm" variant="secondary">
            {source.customLabel ? "重命名书架" : "自定义命名"}
          </Button>
          <p className="text-xs leading-6 text-[color:var(--text-tertiary)]">可以给这个一级书架起一个你更容易识别的名字。</p>
        </div>
      )}
    </div>
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
    case "source":
      return "Named Source";
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

function formatSyncMeta(status: IngestionJobStatus | null, lastSyncedAt: string | null) {
  const label =
    status === IngestionJobStatus.FAILED
      ? "最近同步失败"
      : status === IngestionJobStatus.PROCESSING
        ? "同步中"
        : status === IngestionJobStatus.PENDING
          ? "排队中"
          : "已同步";

  if (!lastSyncedAt) {
    return label;
  }

  return `${label} · ${new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(lastSyncedAt))}`;
}

function SourceSyncButton({ sourceId }: { sourceId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function handleSync() {
    setError(null);

    try {
      const response = await fetch(`/api/sources/${sourceId}/sync`, {
        method: "POST",
      });
      const payload = (await response.json()) as
        | { ok: true }
        | {
            ok: false;
            error: {
              message: string;
            };
          };

      if (!payload.ok) {
        setError(payload.error.message);
        return;
      }

      startTransition(() => {
        router.refresh();
      });
    } catch {
      setError("同步来源失败，请稍后再试。");
    }
  }

  return (
    <div className="space-y-2">
      <Button disabled={isPending} onClick={handleSync} size="sm" variant="secondary">
        {isPending ? "同步中…" : "立即同步"}
      </Button>
      {error ? <p className="text-sm text-[color:var(--badge-danger-text)]">{error}</p> : null}
    </div>
  );
}
