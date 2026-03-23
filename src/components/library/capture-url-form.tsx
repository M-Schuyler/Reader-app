"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";

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
    <form className="rounded-3xl border border-black/10 bg-white/75 p-5 shadow-sm" onSubmit={handleSubmit}>
      <div className="space-y-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-black/45">Capture</p>
          <h3 className="mt-2 font-serif text-xl text-black/90">Save a web page</h3>
          <p className="mt-2 text-sm leading-6 text-black/65">
            This is the only ingestion entry in P1. Submit a URL and the app will fetch, extract, and create a
            document.
          </p>
        </div>

        <label className="block space-y-2 text-sm text-black/70">
          <span>Web URL</span>
          <input
            className="w-full rounded-2xl border border-black/10 bg-white px-4 py-2.5 outline-none transition focus:border-black/30"
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://example.com/article"
            type="url"
            value={url}
          />
        </label>

        {error ? <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

        <button
          className="w-full rounded-2xl bg-stone-900 px-4 py-2.5 text-sm font-medium text-stone-50 transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isSubmitting || isPending || !url.trim()}
          type="submit"
        >
          {isSubmitting || isPending ? "Saving..." : "Save URL"}
        </button>
      </div>
    </form>
  );
}
