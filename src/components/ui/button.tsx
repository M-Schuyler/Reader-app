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
    "bg-[color:var(--text-primary)] text-white hover:bg-[color:var(--text-primary-strong)] border-transparent shadow-[0_10px_24px_rgba(27,24,19,0.12)]",
  secondary:
    "border-[color:var(--border-strong)] bg-[color:var(--bg-surface-strong)] text-[color:var(--text-primary)] hover:border-[color:var(--text-primary)] hover:bg-white",
  quiet:
    "border-transparent bg-transparent text-[color:var(--text-secondary)] hover:bg-black/[0.035] hover:text-[color:var(--text-primary)]",
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
        "inline-flex items-center justify-center border font-medium transition disabled:cursor-not-allowed disabled:opacity-55",
        sizeClassName[size],
        variantClassName[variant],
        className,
      )}
      type={type}
      {...props}
    />
  );
}
