import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { cx } from "@/utils/cx";

type FieldProps = {
  label: string;
  description?: string;
  children: ReactNode;
  className?: string;
};

type TextInputProps = InputHTMLAttributes<HTMLInputElement>;
type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export function Field({ children, className, description, label }: FieldProps) {
  return (
    <label className={cx("block space-y-2.5", className)}>
      <span className="block text-sm font-medium text-[color:var(--text-primary)]">{label}</span>
      {description ? <span className="block text-sm leading-6 text-[color:var(--text-secondary)]">{description}</span> : null}
      {children}
    </label>
  );
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { className, ...props }: TextInputProps,
  ref,
) {
  return (
    <input
      className={cx(
        "min-h-11 w-full rounded-[18px] border border-[color:var(--border-subtle)] bg-[color:var(--bg-field)] px-4 text-sm text-[color:var(--text-primary)] outline-none transition placeholder:text-[color:var(--text-tertiary)] focus:border-[color:var(--border-strong)] focus:bg-[color:var(--bg-field-focus)]",
        className,
      )}
      ref={ref}
      {...props}
    />
  );
});

export function SelectInput({ className, ...props }: SelectProps) {
  return (
    <select
      className={cx(
        "min-h-11 w-full rounded-[18px] border border-[color:var(--border-subtle)] bg-[color:var(--bg-field)] px-4 text-sm text-[color:var(--text-primary)] outline-none transition focus:border-[color:var(--border-strong)] focus:bg-[color:var(--bg-field-focus)]",
        className,
      )}
      {...props}
    />
  );
}
