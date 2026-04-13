"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";

type HeaderAccountMenuProps = {
  email: string | null;
  onOpenChange?: (open: boolean) => void;
  panelPlacement?: "up" | "down";
  panelHorizontal?: "right" | "outside-right";
};

export function HeaderAccountMenu({
  email,
  onOpenChange,
  panelPlacement = "down",
  panelHorizontal = "right",
}: HeaderAccountMenuProps) {
  const avatarLabel = resolveAvatarLabel(email);

  return (
    <details
      className="group relative inline-block [&_summary::-webkit-details-marker]:hidden"
      onToggle={(event) => onOpenChange?.((event.currentTarget as HTMLDetailsElement).open)}
    >
      <summary className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-full bg-stone-800 text-[13px] font-semibold text-white transition hover:ring-2 hover:ring-stone-300">
        <span className="sr-only">打开账户菜单</span>
        <span>{avatarLabel}</span>
      </summary>

      <div
        className={`absolute z-50 w-[18rem] rounded-[26px] border border-[color:var(--border-subtle)] bg-[color:var(--bg-canvas)] p-4 shadow-[var(--shadow-surface)] ${
          panelPlacement === "up" ? "bottom-[calc(100%+0.4rem)]" : "top-[calc(100%+0.4rem)]"
        } ${panelHorizontal === "outside-right" ? "left-[calc(100%+0.4rem)] right-auto" : "right-0"}`}
      >
        <div className="space-y-1 border-b border-[color:var(--border-subtle)] pb-4">
          <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[color:var(--text-tertiary)]">Profile</p>
          <p className="text-sm font-medium text-[color:var(--text-primary)] [overflow-wrap:anywhere]">
            {email ?? "当前账户"}
          </p>
        </div>

        <div className="space-y-4 py-4">
          <section className="space-y-3">
            <p className="text-xs font-medium text-[color:var(--text-secondary)]">个性化</p>
            <ThemeToggle className="w-full justify-between" />
          </section>

          <section className="space-y-2 border-t border-[color:var(--border-subtle)] pt-4">
            <p className="text-xs font-medium text-[color:var(--text-secondary)]">设置</p>
            <Link
              className="inline-flex min-h-9 w-full items-center rounded-[16px] px-3.5 text-sm font-semibold text-[color:var(--text-secondary)] transition hover:bg-[color:var(--button-quiet-hover-bg)] hover:text-[color:var(--text-primary)]"
              href="/export"
            >
              导出
            </Link>
          </section>
        </div>

        <div className="border-t border-[color:var(--border-subtle)] pt-4">
          <Button
            className="w-full"
            onClick={() => {
              void signOut({ callbackUrl: "/login" });
            }}
            size="sm"
            type="button"
            variant="quiet"
          >
            退出登录
          </Button>
        </div>
      </div>
    </details>
  );
}

function resolveAvatarLabel(email: string | null) {
  if (!email) {
    return "R";
  }

  const normalized = email.trim().charAt(0).toUpperCase();
  return normalized || "R";
}
