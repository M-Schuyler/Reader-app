import type { PublishedAtKind } from "@prisma/client";

export function formatPublishedAtLabel(value: string | null, kind: PublishedAtKind) {
  if (!value) {
    return "未知发布时间";
  }

  const formatted = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(value));

  return kind === "BEFORE" ? `${formatted} 之前` : formatted;
}
