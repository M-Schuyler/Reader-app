"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type SourceLibraryMoreMenuProps = {
  sweepHref?: string;
};

export function SourceLibraryMoreMenu({ sweepHref }: SourceLibraryMoreMenuProps) {
  void sweepHref;

  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        className="inline-flex min-h-9 w-9 items-center justify-center rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface-soft)] text-sm text-[color:var(--text-secondary)] transition hover:border-[color:var(--border-strong)] hover:text-[color:var(--text-primary)]"
        onClick={() => setOpen((v) => !v)}
      >
        ···
      </button>

      {open && (
        <div className="absolute right-0 top-[calc(100%+6px)] z-50 min-w-[160px] overflow-hidden rounded-[18px] border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] shadow-[var(--shadow-surface)]">
          <div className="p-1.5">
            <Link
              className="flex w-full items-center gap-2.5 rounded-[12px] px-3 py-2.5 text-sm text-[color:var(--text-secondary)] transition hover:bg-[color:var(--bg-surface-soft)] hover:text-[color:var(--text-primary)]"
              href="/sources/import/cubox"
              onClick={() => setOpen(false)}
            >
              导入 Cubox
            </Link>
            <SweepButton onDone={() => setOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

function SweepButton({ onDone }: { onDone: () => void }) {
  const [state, setState] = useState<"idle" | "running" | "done">("idle");

  async function handleSweep() {
    setState("running");
    try {
      await fetch("/api/summary-jobs/sweep", { method: "POST" });
    } finally {
      setState("done");
      setTimeout(() => {
        setState("idle");
        onDone();
      }, 1500);
    }
  }

  return (
    <button
      className="flex w-full items-center gap-2.5 rounded-[12px] px-3 py-2.5 text-sm text-[color:var(--text-secondary)] transition hover:bg-[color:var(--bg-surface-soft)] hover:text-[color:var(--text-primary)] disabled:opacity-50"
      disabled={state === "running"}
      onClick={handleSweep}
    >
      {state === "idle" && "补跑摘要"}
      {state === "running" && "运行中…"}
      {state === "done" && "完成"}
    </button>
  );
}
