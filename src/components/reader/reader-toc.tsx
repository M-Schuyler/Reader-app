"use client";

import { cx } from "@/utils/cx";
import type { TocItem } from "./use-reader-toc";

type ReaderTableOfContentsProps = {
  activeId: string | null;
  toc: TocItem[];
};

export function ReaderTableOfContents({ activeId, toc }: ReaderTableOfContentsProps) {
  if (toc.length < 2) return null;

  return (
    <nav className="flex flex-col gap-1 py-4">
      <div className="mb-4 px-3 text-[11px] font-medium uppercase tracking-[0.24em] text-[color:var(--text-tertiary)]">
        目录
      </div>
      <ul className="space-y-0.5">
        {toc.map((item) => (
          <li key={item.id}>
            <a
              className={cx(
                "block rounded-lg px-3 py-2 text-[13px] leading-tight transition-all duration-200 hover:bg-[color:var(--bg-surface-soft)]",
                activeId === item.id
                  ? "font-medium text-[color:var(--text-primary)] translate-x-1"
                  : "text-[color:var(--text-tertiary)] hover:text-[color:var(--text-secondary)]",
                item.level === 2 ? "pl-3" : "pl-7" // Indent h3 relative to h2
              )}
              href={`#${item.id}`}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(item.id)?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                });
              }}
            >
              <span className={cx(
                "inline-block transition-opacity duration-200",
                activeId === item.id ? "opacity-100" : "opacity-0"
              )}>
                ·
              </span>
              <span className={activeId === item.id ? "ml-1.5" : "ml-0"}>
                {item.text}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
