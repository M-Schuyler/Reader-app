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
        setError(payload.error.message);
        return;
      }

      startTransition(() => {
        router.push(`/documents/${payload.data.document.id}`);
        router.refresh();
      });
    } catch {
      setError("Failed to submit the URL.");
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
        <h2 className="font-display text-[1.6rem] leading-tight tracking-[-0.02em] text-[color:var(--text-primary)]">
          Import a web page
        </h2>
        <p className="text-sm leading-6 text-[color:var(--text-secondary)]">
          Drop in a link and send it straight into the reading flow.
        </p>
      </div>

      <Field label="Web URL">
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
        {isSubmitting || isPending ? "Importing..." : "Import URL"}
      </Button>
    </form>
  );
}
