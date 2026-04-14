"use client";

import { useState } from "react";
import { cx } from "@/utils/cx";

type ReaderCodeBlockProps = {
  code: string;
};

export function ReaderCodeBlock({ code }: ReaderCodeBlockProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy code:", err);
    }
  }

  return (
    <div className="group relative">
      <pre className="overflow-x-auto rounded-[22px] border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] p-5 font-mono text-[0.95rem] leading-7 text-[color:var(--text-primary)]">
        <code>{code}</code>
      </pre>
      
      <button
        className={cx(
          "absolute right-4 top-4 flex h-8 items-center gap-1.5 rounded-full border border-[color:var(--border-strong)] bg-[color:var(--bg-surface-strong)] px-3 text-[11px] font-semibold text-[color:var(--text-secondary)] opacity-0 transition-all hover:text-[color:var(--text-primary)] group-hover:opacity-100",
          copied ? "text-[color:var(--badge-success-text)]" : ""
        )}
        onClick={handleCopy}
        type="button"
      >
        {copied ? (
          <>
            <CheckIcon />
            <span>已复制</span>
          </>
        ) : (
          <>
            <CopyIcon />
            <span>复制</span>
          </>
        )}
      </button>
    </div>
  );
}

function CopyIcon() {
  return (
    <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
      <rect height="13" rx="2" ry="2" width="13" x="9" y="9" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
