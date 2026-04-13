"use client";

import Link from "next/link";
import { HighlightsNavIcon, ReadingNavIcon, SearchNavIcon, SourcesNavIcon } from "@/components/layout/navigation-icons";
import type { PrimaryNavItem } from "@/lib/product-shell";
import { cx } from "@/utils/cx";

type MobileBottomNavProps = {
  items: PrimaryNavItem[];
  onSearchOpen: () => void;
};

export function MobileBottomNav({ items, onSearchOpen }: MobileBottomNavProps) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[color:var(--border-subtle)] bg-[color:var(--bg-surface-strong)] px-3 py-2 md:hidden">
      <div className="grid grid-cols-4 gap-2">
        {items.map((item) => {
          const baseClass =
            "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-2 text-[11px] font-medium whitespace-nowrap transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--border-strong)]";
          const stateClass = item.isActive
            ? "bg-stone-900 !text-white"
            : "text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-surface-soft)] hover:text-[color:var(--text-primary)]";

          if (item.kind === "action") {
            return (
              <button
                className={cx(baseClass, stateClass)}
                data-active={item.isActive ? "true" : "false"}
                key={item.id}
                onClick={onSearchOpen}
                type="button"
              >
                <SearchNavIcon className="h-5 w-5 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          }

          return (
            <Link
              className={cx(baseClass, stateClass)}
              data-active={item.isActive ? "true" : "false"}
              href={item.href ?? "/sources"}
              key={item.id}
            >
              {resolvePrimaryNavIcon(item.id)}
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function resolvePrimaryNavIcon(id: PrimaryNavItem["id"]) {
  if (id === "sources") {
    return <SourcesNavIcon className="h-5 w-5 shrink-0" />;
  }

  if (id === "reading") {
    return <ReadingNavIcon className="h-5 w-5 shrink-0" />;
  }

  return <HighlightsNavIcon className="h-5 w-5 shrink-0" />;
}
