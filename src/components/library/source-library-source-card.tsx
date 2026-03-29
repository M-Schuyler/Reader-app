"use client";

import Link from "next/link";
import type { SourceLibrarySourceKind } from "@/lib/documents/source-library";
import { cx } from "@/utils/cx";

export type SourceLibraryTone = {
  cover: string;
  spine: string;
};

export const SOURCE_LIBRARY_TONES: readonly SourceLibraryTone[] = [
  {
    cover: "border-[#d8c7af]/80 bg-[#efe4d3]",
    spine: "bg-[#b68b5d]",
  },
  {
    cover: "border-[#c7d0d6]/80 bg-[#e4eaee]",
    spine: "bg-[#7f92a0]",
  },
  {
    cover: "border-[#d5cec3]/80 bg-[#eee7dd]",
    spine: "bg-[#9b8064]",
  },
  {
    cover: "border-[#d2d6c7]/80 bg-[#edf0e5]",
    spine: "bg-[#7b8d6a]",
  },
] as const;

type SourceLibrarySourceCardProps = {
  label: string;
  host: string | null;
  kind: SourceLibrarySourceKind;
  meta: string;
  latestLabel?: string | null;
  href: string | null;
  tone: SourceLibraryTone;
  variant?: "index" | "hero";
};

export function getSourceLibraryTone(index: number) {
  return SOURCE_LIBRARY_TONES[index % SOURCE_LIBRARY_TONES.length];
}

export function getSourceLibraryToneForSeed(seed: string | null | undefined) {
  if (!seed) {
    return getSourceLibraryTone(0);
  }

  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 33 + seed.charCodeAt(index)) >>> 0;
  }

  return getSourceLibraryTone(hash);
}

export function SourceLibrarySourceCard({
  label,
  host,
  kind,
  meta,
  latestLabel,
  href,
  tone,
  variant = "index",
}: SourceLibrarySourceCardProps) {
  const isHero = variant === "hero";
  const body = (
    <div
      className={cx(
        "relative overflow-hidden rounded-[34px] border shadow-[var(--shadow-surface-muted)] transition",
        tone.cover,
        isHero ? "h-[20rem] p-6 sm:h-[21.5rem]" : "h-[17.5rem] p-5",
        href ? "group-hover:shadow-[var(--shadow-surface)] group-focus-visible:shadow-[var(--shadow-surface)]" : "opacity-72",
      )}
    >
      <span className="absolute inset-y-5 left-4 w-[4px] rounded-full bg-white/55" />
      <span className={cx("absolute inset-y-5 left-[22px] w-[7px] rounded-full opacity-85", tone.spine)} />

      <div className={cx("relative z-10 flex h-full flex-col justify-between", isHero ? "pl-9" : "pl-8")}>
        <div className="space-y-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-black/42">{formatSourceKind(kind)}</p>
          <div className="space-y-2">
            <h3
              className={cx(
                "max-w-full font-ui-heading tracking-[-0.045em] text-black/80 [overflow-wrap:anywhere]",
                isHero
                  ? "line-clamp-4 text-[clamp(2rem,4.3vw,2.7rem)] leading-[0.95]"
                  : "line-clamp-5 text-[clamp(1.75rem,3vw,1.95rem)] leading-[0.98]",
              )}
            >
              {label}
            </h3>
            <p className="max-w-full text-sm leading-6 text-black/48 [overflow-wrap:anywhere]">
              {host && host !== label ? host : "统一来源"}
            </p>
          </div>
        </div>

        <div className="space-y-1.5 text-sm text-black/56">
          <p>{meta}</p>
          {latestLabel ? <p>{latestLabel}</p> : null}
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
    case "feed":
      return "Feed Source";
    case "domain":
      return "Web Source";
    case "unknown":
    default:
      return "Collected";
  }
}
