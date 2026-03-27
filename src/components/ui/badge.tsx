import type { HTMLAttributes, ReactNode } from "react";
import { cx } from "@/utils/cx";

type BadgeTone = "neutral" | "success" | "warning" | "danger" | "subtle";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  children: ReactNode;
  tone?: BadgeTone;
};

const toneClassName: Record<BadgeTone, string> = {
  neutral: "bg-[color:var(--badge-neutral-bg)] text-[color:var(--badge-neutral-text)]",
  success: "bg-[color:var(--badge-success-bg)] text-[color:var(--badge-success-text)]",
  warning: "bg-[color:var(--badge-warning-bg)] text-[color:var(--badge-warning-text)]",
  danger: "bg-[color:var(--badge-danger-bg)] text-[color:var(--badge-danger-text)]",
  subtle: "bg-[color:var(--badge-subtle-bg)] text-[color:var(--text-tertiary)]",
};

export function Badge({ children, className, tone = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium tracking-[0.02em]",
        toneClassName[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}
