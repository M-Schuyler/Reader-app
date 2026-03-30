"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/form-controls";

type CreateSourceApiResponse =
  | {
      ok: true;
      data: {
        deduped: boolean;
        source: {
          id: string;
        };
      };
    }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
      };
    };

export function CreateSourceForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [locatorUrl, setLocatorUrl] = useState("");
  const [backfillStartAt, setBackfillStartAt] = useState("");
  const [includeCategories, setIncludeCategories] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successHref, setSuccessHref] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccessHref(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/sources", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          kind: "RSS",
          title,
          locatorUrl,
          backfillStartAt: backfillStartAt || null,
          includeCategories: includeCategories || null,
        }),
      });
      const payload = (await response.json()) as CreateSourceApiResponse;

      if (!payload.ok) {
        setError(localizeSourceError(payload.error.code));
        return;
      }

      const href = `/sources/${payload.data.source.id}`;
      if (payload.data.deduped) {
        setSuccessHref(href);
        return;
      }

      startTransition(() => {
        router.push(href);
        router.refresh();
      });
    } catch {
      setError("创建来源失败，请稍后再试。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-3.5" onSubmit={handleSubmit}>
      <div className="space-y-1">
        <h2 className="font-ui-heading text-[1.2rem] leading-tight tracking-[-0.03em] text-[color:var(--text-primary)]">
          添加 RSS 来源
        </h2>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Field label="来源名称">
          <TextInput
            className="min-h-10 rounded-[16px]"
            onChange={(event) => setTitle(event.target.value)}
            placeholder="请辩 RSS"
            value={title}
          />
        </Field>

        <Field label="起始时间">
          <TextInput
            className="min-h-10 rounded-[16px]"
            onChange={(event) => setBackfillStartAt(event.target.value)}
            type="date"
            value={backfillStartAt}
          />
        </Field>
      </div>

      <Field label="Feed 或站点入口">
        <TextInput
          className="min-h-10 rounded-[16px]"
          onChange={(event) => setLocatorUrl(event.target.value)}
          placeholder="https://example.com/feed.xml"
          type="url"
          value={locatorUrl}
        />
      </Field>

      <Field label="分类过滤（可选）">
        <TextInput
          className="min-h-10 rounded-[16px]"
          onChange={(event) => setIncludeCategories(event.target.value)}
          placeholder="Tech, Reviews"
          value={includeCategories}
        />
      </Field>

      <Button disabled={isSubmitting || isPending || !title.trim() || !locatorUrl.trim()} size="sm" type="submit" variant="primary">
        {isSubmitting || isPending ? "创建中…" : "创建来源"}
      </Button>

      {error ? (
        <p className="rounded-[18px] border border-[color:var(--badge-danger-bg)] bg-[color:var(--badge-danger-bg)] px-4 py-3 text-sm text-[color:var(--badge-danger-text)]">
          {error}
        </p>
      ) : null}

      {successHref ? (
        <div className="rounded-[18px] border border-[color:var(--badge-success-bg)] bg-[color:var(--badge-success-bg)] px-4 py-3 text-sm text-[color:var(--badge-success-text)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p>这个来源已经存在，直接进入它的来源页继续看。</p>
            <Link
              className="inline-flex min-h-9 items-center justify-center rounded-[16px] border border-[color:var(--border-strong)] bg-[color:var(--bg-surface-strong)] px-3.5 text-sm font-semibold text-[color:var(--text-primary)] transition hover:border-[color:var(--text-primary)] hover:bg-[color:var(--button-secondary-hover-bg)]"
              href={successHref}
            >
              打开来源
            </Link>
          </div>
        </div>
      ) : null}
    </form>
  );
}

function localizeSourceError(code: string) {
  switch (code) {
    case "SOURCE_DISCOVERY_FAILED":
    case "FEED_FETCH_FAILED":
      return "无法解析这个 RSS 来源，请检查入口链接后再试。";
    case "SOURCE_KIND_NOT_SUPPORTED":
      return "这个来源类型已经预留，但本轮只开放 RSS 来源。";
    default:
      return "创建来源失败，请稍后再试。";
  }
}
