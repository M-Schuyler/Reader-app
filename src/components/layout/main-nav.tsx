"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getMainNavItems } from "@/lib/product-shell";
import { cx } from "@/utils/cx";

export function MainNav() {
  const pathname = usePathname();
  const items = getMainNavItems(pathname);

  return (
    <nav className="overflow-x-auto text-sm">
      <div className="inline-flex items-center gap-1 whitespace-nowrap">
        {items.map((item) => (
          <Link
            className={cx(
              "relative inline-flex min-h-9 items-center justify-center px-2.5 transition-colors",
              item.isActive
                ? "font-medium text-stone-900 after:absolute after:bottom-1 after:left-2 after:right-2 after:h-0.5 after:rounded-full after:bg-stone-900"
                : "font-normal text-stone-400 hover:text-stone-700",
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
