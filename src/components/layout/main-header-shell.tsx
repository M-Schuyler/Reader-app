"use client";

import type { ReactNode } from "react";
import { cx } from "@/utils/cx";

type MainHeaderShellProps = {
  children: ReactNode;
  className?: string;
};

export function MainHeaderShell({ children, className }: MainHeaderShellProps) {
  return (
    <header className={cx("sticky top-0 z-30 border-b border-[color:var(--border-subtle)] bg-[color:var(--bg-header)]", className)}>
      {children}
    </header>
  );
}
