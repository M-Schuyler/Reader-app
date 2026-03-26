import type { ReactNode } from "react";
import { cx } from "@/utils/cx";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
};

export function PageHeader({ actions, className, description, eyebrow, title }: PageHeaderProps) {
  return (
    <header className={cx("flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between", className)}>
      <div className="space-y-3">
        {eyebrow ? (
          <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[color:var(--text-tertiary)]">
            {eyebrow}
          </p>
        ) : null}
        <div className="space-y-3">
          <h1 className="font-display text-4xl leading-[1.02] tracking-[-0.03em] text-[color:var(--text-primary)] sm:text-[3.25rem]">
            {title}
          </h1>
          {description ? (
            <p className="max-w-3xl text-[15px] leading-7 text-[color:var(--text-secondary)]">{description}</p>
          ) : null}
        </div>
      </div>

      {actions ? <div className="flex shrink-0 items-center gap-3">{actions}</div> : null}
    </header>
  );
}
