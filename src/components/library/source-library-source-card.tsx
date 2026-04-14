"use client";

import Link from "next/link";
import type { SourceLibrarySourceKind } from "@/lib/documents/source-library";
import { cx } from "@/utils/cx";

export type SourceLibraryTone = {
  accent: string;
  bg: string;
};

// Unified palette aligned with the reader's bronze/paper theme
export const SOURCE_LIBRARY_TONES: readonly SourceLibraryTone[] = [
  {
    accent: "bg-[color:var(--ai-card-accent)]",
    bg: "bg-[color:var(--bg-surface)]",
  },
] as const;

type SourceLibrarySourceCardProps = {
  label: string;
  host: string | null;
  kind: SourceLibrarySourceKind;
  meta: string;
  filterSummary?: string | null;
  latestLabel?: string | null;
  href: string | null;
  tone?: SourceLibraryTone;
  variant?: "index" | "hero";
};

export function getSourceLibraryTone(index: number) {
  return SOURCE_LIBRARY_TONES[0];
}

export function getSourceLibraryToneForSeed(seed: string | null | undefined) {
  return SOURCE_LIBRARY_TONES[0];
}

export function SourceLibrarySourceCard({
  label,
  host,
  kind,
  meta,
  filterSummary,
  latestLabel,
  href,
  tone: propTone,
  variant = "index",
}: SourceLibrarySourceCardProps) {
  const isHero = variant === "hero";
  const tone = propTone || SOURCE_LIBRARY_TONES[0];
  
  const body = (
    <div
      className={cx(
        "relative overflow-hidden rounded-[32px] border border-[color:var(--border-subtle)] transition-all duration-500 cubic-bezier(0.22, 1, 0.36, 1)",
        tone.bg,
        isHero ? "h-[22rem] p-8 sm:h-[24rem]" : "h-[18rem] p-6",
        href ? "group-hover:-translate-y-1.5 group-hover:border-[color:var(--border-strong)] group-hover:shadow-[var(--shadow-surface)] shadow-[var(--shadow-surface-muted)]" : "opacity-72",
      )}
    >
      {/* Visual Stacking Effect: suggests this is a container of multiple documents */}
      <div className="absolute right-[-4px] top-6 h-[75%] w-1 rounded-l-full bg-black/[0.04] transition-transform duration-500 group-hover:translate-x-1" />
      <div className="absolute right-[-8px] top-12 h-[60%] w-1 rounded-l-full bg-black/[0.02] transition-transform duration-500 group-hover:translate-x-2" />

      {/* Side Accent: elegant replacement for the old thick spine */}
      <div className={cx("absolute inset-y-8 left-0 w-1.5 rounded-r-full opacity-50 transition-opacity group-hover:opacity-100", tone.accent)} />

      <div className={cx("relative z-10 flex h-full flex-col justify-between pl-6")}>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[color:var(--text-tertiary)] opacity-70">
              {formatSourceKind(kind)}
            </p>
            {isHero && (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-[color:var(--ai-card-accent)] uppercase tracking-wider">Featured</span>
                <div className="h-1.5 w-1.5 rounded-full bg-[color:var(--ai-card-accent)] animate-pulse" />
              </div>
            )}
          </div>
          
          <div className="space-y-3">
            <h3
              className={cx(
                "max-w-full font-ui-heading font-bold tracking-[-0.04em] text-[color:var(--text-primary)] [overflow-wrap:anywhere] transition-colors group-hover:text-[color:var(--text-primary-strong)]",
                isHero
                  ? "line-clamp-3 text-[clamp(2.2rem,5vw,3rem)] leading-[1.05]"
                  : "line-clamp-4 text-[clamp(1.65rem,3.5vw,1.9rem)] leading-[1.1]",
              )}
            >
              {label}
            </h3>
            <p className="max-w-full text-[13px] font-medium leading-5 text-[color:var(--text-tertiary)] [overflow-wrap:anywhere] opacity-60">
              {host && host !== label ? host : "来源频道"}
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {filterSummary ? (
            <p className="line-clamp-2 text-[14px] leading-relaxed text-[color:var(--text-secondary)] opacity-90 italic font-serif border-l border-[color:var(--border-subtle)] pl-3">
              {filterSummary}
            </p>
          ) : null}
          
          <div className="flex flex-col gap-1 pt-1">
            <div className="flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-widest text-[color:var(--text-tertiary)] opacity-50 group-hover:opacity-80 transition-opacity">
              <span>{meta}</span>
              {latestLabel && (
                <>
                  <span className="opacity-30">·</span>
                  <span className="normal-case tracking-normal font-medium">{latestLabel}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  if (!href) {
    return (
      <div aria-disabled="true" className="block cursor-default">
        {body}
      </div>
    );
  }

  return (
    <Link className="group block focus-visible:outline-none" href={href}>
      {body}
    </Link>
  );
}

function formatSourceKind(kind: SourceLibrarySourceKind) {
  switch (kind) {
    case "source":
      return "Library";
    case "feed":
      return "RSS Feed";
    case "domain":
      return "Web Stream";
    case "unknown":
    default:
      return "Collection";
  }
}
