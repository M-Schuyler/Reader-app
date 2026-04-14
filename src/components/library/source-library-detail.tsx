"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { IngestionJobStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/ui/form-controls";
import { Panel } from "@/components/ui/panel";
import type { GetDocumentsResponseData } from "@/server/modules/documents/document.types";
import { SourceLibrarySourceContext } from "@/lib/documents/source-library";
import { DocumentList } from "./document-list";
import { SourceLibraryDetailFilters } from "./source-library-detail-filters";

type SourceLibraryDetailProps = {
  data: GetDocumentsResponseData;
  source: SourceLibrarySourceContext;
  backHref?: string;
  clearHref?: string;
  hasActiveFilters?: boolean;
};

export function SourceLibraryDetail({
  data,
}: SourceLibraryDetailProps) {
  return (
    <div className="space-y-6">
      {data.items.length > 0 ? (
        <DocumentList data={data} showDelete={true} />
      ) : (
        <Panel className="px-8 py-12 text-center" tone="muted">
          <div className="mx-auto max-w-lg space-y-3">
            <h3 className="font-ui-heading text-[2rem] leading-tight tracking-[-0.04em] text-[color:var(--text-primary)]">
              这个来源下暂时没有符合当前筛选的内容
            </h3>
            <p className="text-sm leading-7 text-[color:var(--text-secondary)]">
              来源还在，只是当前筛选条件把结果收窄了。你可以清空筛选，再回来看这一架完整的内容。
            </p>
          </div>
        </Panel>
      )}
    </div>
  );
}

export function SourceAliasEditor({ source }: { source: SourceLibrarySourceContext }) {
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
    <div className="space-y-2 sm:max-w-[17rem]">
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
          <p className="text-xs leading-6 text-[color:var(--text-tertiary)]">给这个来源起一个你更容易识别的名字。</p>
        </div>
      )}
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

export function SourceSyncButton({ sourceId }: { sourceId: string }) {
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
