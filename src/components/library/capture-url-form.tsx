"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/form-controls";
import { cx } from "@/utils/cx";

type CaptureUrlApiResponse =
  | {
      ok: true;
      data: {
        document: {
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

type CaptureUrlFormProps = {
  variant?: "panel" | "compact";
};

export function CaptureUrlForm({ variant = "panel" }: CaptureUrlFormProps) {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPending, startTransition] = useTransition();
  const isCompact = variant === "compact";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
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
        setError(localizeCaptureError(payload.error.code));
        return;
      }

      startTransition(() => {
        router.push("/sources");
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
        <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[color:var(--text-tertiary)]">Capture</p>
        <h2
          className={cx(
            "font-ui-heading leading-tight tracking-[-0.03em] text-[color:var(--text-primary)]",
            isCompact ? "text-[1.2rem]" : "text-[1.6rem]",
          )}
        >
          保存网页链接
        </h2>
        <p className={cx("leading-6 text-[color:var(--text-secondary)]", isCompact ? "text-[13px]" : "text-sm")}>
          新内容先进入来源库，真正开始读的时候再进入 Reading。
        </p>
      </div>

      <div className={cx(isCompact ? "flex flex-col gap-3 md:flex-row md:items-end" : "space-y-5")}>
        <Field className={cx(isCompact ? "min-w-0 flex-1" : undefined)} label="网页链接">
          <TextInput
            className={cx(isCompact ? "min-h-10 rounded-[16px]" : undefined)}
            onChange={(event) => setUrl(event.target.value)}
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
    </form>
  );
}

function localizeCaptureError(code: string) {
  switch (code) {
    case "INVALID_URL":
      return "链接格式不正确，请检查后再试。";
    case "FETCH_FAILED":
      return "抓取原始链接失败，请稍后再试。";
    case "CAPTURE_FAILED":
      return "保存链接失败，请稍后再试。";
    default:
      return "保存链接失败，请稍后再试。";
  }
}
