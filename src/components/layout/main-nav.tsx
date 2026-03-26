"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/utils/cx";

export function MainNav() {
  const pathname = usePathname();
  const isLibraryActive = pathname === "/library" || pathname.startsWith("/documents/");

  return (
    <nav className="flex items-center gap-1.5 text-sm text-[color:var(--text-secondary)]">
      <Link
        className={cx(
          "inline-flex min-h-9 items-center rounded-full border px-3.5 transition",
          isLibraryActive
            ? "border-[color:var(--border-strong)] bg-[color:var(--bg-surface-soft)] text-[color:var(--text-primary)]"
            : "border-[color:var(--border-subtle)] bg-transparent hover:border-[color:var(--border-strong)] hover:bg-[color:var(--bg-surface-soft)] hover:text-[color:var(--text-primary)]",
        )}
        href="/library"
      >
        Library
      </Link>
    </nav>
  );
}
