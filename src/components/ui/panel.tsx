import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "@/utils/cx";

type PanelTone = "default" | "muted" | "transparent";
type PanelPadding = "none" | "sm" | "md" | "lg";

type PanelProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  tone?: PanelTone;
  padding?: PanelPadding;
};

const toneClassName: Record<PanelTone, string> = {
  default:
    "border-[color:var(--border-subtle)] bg-[color:var(--bg-surface-strong)] shadow-[var(--shadow-surface)]",
  muted:
    "border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] shadow-[var(--shadow-surface-muted)]",
  transparent: "border-transparent bg-transparent shadow-none",
};

const paddingClassName: Record<PanelPadding, string> = {
  none: "",
  sm: "p-4",
  md: "p-5",
  lg: "p-7",
};

export function Panel({
  children,
  className,
  padding = "md",
  tone = "default",
  ...props
}: PanelProps) {
  return (
    <div
      className={cx("rounded-[28px] border", toneClassName[tone], paddingClassName[padding], className)}
      {...props}
    >
      {children}
    </div>
  );
}
