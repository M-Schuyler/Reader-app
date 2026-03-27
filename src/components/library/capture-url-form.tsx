"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/form-controls";

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

export function CaptureUrlForm() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPending, startTransition] = useTransition();

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
        router.push(`/documents/${payload.data.document.id}`);
        router.refresh();
      });
    } catch {
      setError("提交链接失败，请稍后再试。");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="space-y-1.5">
        <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[color:var(--text-tertiary)]">
          Capture
        </p>
        <h2 className="font-ui-heading text-[1.6rem] leading-tight tracking-[-0.03em] text-[color:var(--text-primary)]">
          保存网页链接
        </h2>
        <p className="text-sm leading-6 text-[color:var(--text-secondary)]">
          先把链接收进文档库，再决定它值不值得深读。
        </p>
      </div>

      <Field label="网页链接">
        <TextInput
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://example.com/article"
          type="url"
          value={url}
        />
      </Field>

      {error ? (
        <p className="rounded-[18px] border border-[color:var(--badge-danger-bg)] bg-[color:var(--badge-danger-bg)] px-4 py-3 text-sm text-[color:var(--badge-danger-text)]">
          {error}
        </p>
      ) : null}

      <Button className="w-full" disabled={isSubmitting || isPending || !url.trim()} type="submit" variant="primary">
        {isSubmitting || isPending ? "导入中…" : "导入链接"}
      </Button>
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
