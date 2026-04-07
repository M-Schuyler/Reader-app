import type { PublishedAtKind } from "@prisma/client";

export function formatPublishedAtLabel(value: string | null, kind: PublishedAtKind, importedAt?: string | null) {
  if (!value) {
    return importedAt ? `导入于 ${formatDateLabel(importedAt)}` : "未知发布时间";
  }

  const formatted = formatDateLabel(value);
  return kind === "BEFORE" ? `${formatted} 之前` : formatted;
}

export function resolveDocumentDateMetaLabel(value: string | null, importedAt?: string | null) {
  if (value) {
    return "发布时间";
  }

  return importedAt ? "导入时间" : "发布时间";
}

function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}
