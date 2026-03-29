"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getMainNavItems } from "@/lib/product-shell";
import { cx } from "@/utils/cx";

export function MainNav() {
  const pathname = usePathname();
  const items = getMainNavItems(pathname);

  return (
    <nav className="overflow-x-auto text-sm text-[color:var(--text-secondary)]">
      <div className="inline-flex items-center rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface-soft)] p-1 whitespace-nowrap">
        {items.map((item) => (
          <Link
            className={cx(
              "inline-flex min-h-9 min-w-[4.9rem] items-center justify-center rounded-full px-4 font-semibold transition",
              item.isActive
                ? "bg-[color:var(--bg-surface-strong)] text-[color:var(--text-primary)] shadow-[var(--shadow-surface-muted)]"
                : "text-[color:var(--text-secondary)] hover:bg-[color:var(--button-quiet-hover-bg)] hover:text-[color:var(--text-primary)]",
            )}
            href={item.href}
            key={item.href}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
