import type { ButtonHTMLAttributes } from "react";
import { cx } from "@/utils/cx";

type ButtonVariant = "primary" | "secondary" | "quiet";
type ButtonSize = "sm" | "md";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

const variantClassName: Record<ButtonVariant, string> = {
  primary:
    "border-transparent bg-[color:var(--button-primary-bg)] text-[color:var(--button-primary-text)] hover:bg-[color:var(--button-primary-hover-bg)] shadow-[var(--shadow-surface-muted)]",
  secondary:
    "border-[color:var(--border-strong)] bg-[color:var(--bg-surface-strong)] text-[color:var(--text-primary)] hover:border-[color:var(--text-primary)] hover:bg-[color:var(--button-secondary-hover-bg)]",
  quiet:
    "border-transparent bg-transparent text-[color:var(--text-secondary)] hover:bg-[color:var(--button-quiet-hover-bg)] hover:text-[color:var(--text-primary)]",
};

const sizeClassName: Record<ButtonSize, string> = {
  sm: "min-h-9 rounded-[16px] px-3.5 text-sm",
  md: "min-h-11 rounded-[20px] px-4.5 text-sm",
};

export function Button({
  className,
  size = "md",
  type = "button",
  variant = "secondary",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center border font-semibold transition disabled:cursor-not-allowed disabled:opacity-55",
        sizeClassName[size],
        variantClassName[variant],
        className,
      )}
      type={type}
      {...props}
    />
  );
}
