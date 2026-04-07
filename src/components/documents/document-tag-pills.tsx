"use client";

import Link from "next/link";
import type { DocumentTagLabel } from "@/server/modules/documents/document.types";
import { cx } from "@/utils/cx";

type DocumentTagPillsProps = {
  tags: DocumentTagLabel[];
  basePath: string;
  className?: string;
};

export function DocumentTagPills({ basePath, className, tags }: DocumentTagPillsProps) {
  if (tags.length === 0) {
    return null;
  }

  return (
    <div className={cx("flex flex-wrap gap-2", className)}>
      {tags.map((tag) => (
        <Link
          className="inline-flex min-h-8 items-center rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface-soft)] px-3 text-sm text-[color:var(--text-secondary)] transition hover:border-[color:var(--border-strong)] hover:text-[color:var(--text-primary)]"
          href={buildTagFilterHref(basePath, tag.slug)}
          key={tag.slug}
        >
          #{tag.name}
        </Link>
      ))}
    </div>
  );
}

function buildTagFilterHref(basePath: string, slug: string) {
  return `${basePath}?tag=${encodeURIComponent(slug)}`;
}
