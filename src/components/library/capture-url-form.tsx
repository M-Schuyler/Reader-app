"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/form-controls";
import {
  resolveCaptureUrlSubmitSuccess,
  type CaptureUrlSubmitPayload,
  type CaptureUrlSubmitSuccess,
} from "@/lib/capture/capture-url-submit-result";
import { cx } from "@/utils/cx";

type CaptureUrlApiResponse =
  | {
      ok: true;
      data: CaptureUrlSubmitPayload;
    }
  | {
      ok: false;
      error: {
        code: string;
        message: string;
      };
    };

type CaptureUrlFormProps = {
  variant?: "panel" | "compact";
};

export function CaptureUrlForm({ variant = "panel" }: CaptureUrlFormProps) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<CaptureUrlSubmitSuccess | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPending, startTransition] = useTransition();
  const isCompact = variant === "compact";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/capture/url", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ url }),
      });

      const payload = (await response.json()) as CaptureUrlApiResponse;

      if (!payload.ok) {
        setError(localizeCaptureError(payload.error.code, payload.error.message));
        return;
      }

      const submitResult = resolveCaptureUrlSubmitSuccess(payload.data);
      if (submitResult.kind === "deduped" || submitResult.kind === "failed") {
        setSuccess(submitResult);
        if (submitResult.kind === "deduped") {
          setUrl("");
        }
        return;
      }

      startTransition(() => {
        router.push(submitResult.href);
        router.refresh();
      });
    } catch {
      setError("提交链接失败，请稍后再试。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className={cx(isCompact ? "space-y-3.5" : "space-y-5")} onSubmit={handleSubmit}>
      <div className={cx(isCompact ? "space-y-1" : "space-y-1.5")}>
        <h2
          className={cx(
            "font-ui-heading leading-tight tracking-[-0.03em] text-[color:var(--text-primary)]",
            isCompact ? "text-[1.2rem]" : "text-[1.6rem]",
          )}
        >
          保存网页链接
        </h2>
      </div>

      <div className={cx(isCompact ? "flex flex-col gap-3 md:flex-row md:items-end" : "space-y-5")}>
        <Field className={cx(isCompact ? "min-w-0 flex-1" : undefined)} label="网页链接">
          <TextInput
            className={cx(isCompact ? "min-h-10 rounded-[16px]" : undefined)}
            onChange={(event) => {
              setUrl(event.target.value);
              if (success) {
                setSuccess(null);
              }
            }}
            placeholder="https://example.com/article"
            type="url"
            value={url}
          />
        </Field>

        <Button
          className={cx(isCompact ? "w-full md:w-auto md:min-w-[7.5rem]" : "w-full")}
          disabled={isSubmitting || isPending || !url.trim()}
          size={isCompact ? "sm" : "md"}
          type="submit"
          variant="primary"
        >
          {isSubmitting || isPending ? "导入中…" : "导入链接"}
        </Button>
      </div>

      {error ? (
        <p className="rounded-[18px] border border-[color:var(--badge-danger-bg)] bg-[color:var(--badge-danger-bg)] px-4 py-3 text-sm text-[color:var(--badge-danger-text)]">
          {error}
        </p>
      ) : null}

      {success?.kind === "deduped" || success?.kind === "failed" ? (
        <div
          className={cx(
            "rounded-[18px] border px-4 py-3 text-sm",
            success.kind === "failed"
              ? "border-[color:var(--badge-danger-bg)] bg-[color:var(--badge-danger-bg)] text-[color:var(--badge-danger-text)]"
              : "border-[color:var(--badge-success-bg)] bg-[color:var(--badge-success-bg)] text-[color:var(--badge-success-text)]",
          )}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p>{success.message}</p>
            <Link
              className="inline-flex min-h-9 items-center justify-center rounded-[16px] border border-[color:var(--border-strong)] bg-[color:var(--bg-surface-strong)] px-3.5 text-sm font-semibold text-[color:var(--text-primary)] transition hover:border-[color:var(--text-primary)] hover:bg-[color:var(--button-secondary-hover-bg)]"
              href={success.actionHref}
            >
              {success.actionLabel}
            </Link>
          </div>
        </div>
      ) : null}
    </form>
  );
}

function localizeCaptureError(code: string, message: string) {
  switch (code) {
    case "INVALID_URL":
      return "链接格式不正确，请检查后再试。";
    case "SOURCE_VERIFICATION_REQUIRED":
      return "这篇微信文章触发了来源验证，当前环境下还抓不到正文。";
    case "EXTRACTION_EMPTY":
      return "页面打开了，但没有提取到可阅读正文。";
    case "EXTRACTION_UNREADABLE":
      return message;
    case "FETCH_FAILED":
      return "抓取原始链接失败，请稍后再试。";
    case "CAPTURE_FAILED":
      return "保存链接失败，请稍后再试。";
    default:
      return message || "保存链接失败，请稍后再试。";
  }
}
