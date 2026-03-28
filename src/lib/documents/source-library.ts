import { IngestionStatus } from "@prisma/client";
import type { DocumentListItem } from "@/server/modules/documents/document.types";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * ONE_DAY_MS;

export type SourceShelfSection = {
  key: "recent" | "week" | "older";
  label: string;
  description: string;
  items: DocumentListItem[];
};

const SOURCE_SHELF_META: Record<SourceShelfSection["key"], Omit<SourceShelfSection, "items">> = {
  recent: {
    key: "recent",
    label: "最近收进来",
    description: "Fresh arrivals",
  },
  week: {
    key: "week",
    label: "近七天",
    description: "This week",
  },
  older: {
    key: "older",
    label: "更早",
    description: "Backlist",
  },
};

export function buildSourceShelfSections(
  items: DocumentListItem[],
  now: Date = new Date(),
): SourceShelfSection[] {
  const groups: Record<SourceShelfSection["key"], DocumentListItem[]> = {
    recent: [],
    week: [],
    older: [],
  };

  const sortedItems = [...items].sort((left, right) => {
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });

  for (const item of sortedItems) {
    groups[resolveShelfKey(item.createdAt, now)].push(item);
  }

  return (Object.keys(SOURCE_SHELF_META) as Array<SourceShelfSection["key"]>)
    .map((key) => ({
      ...SOURCE_SHELF_META[key],
      items: groups[key],
    }))
    .filter((section) => section.items.length > 0);
}

export function resolveSourceLibraryPreviewText(item: DocumentListItem) {
  if (item.ingestionStatus === IngestionStatus.FAILED) {
    return null;
  }

  return normalizePreviewText(item.aiSummary) ?? normalizePreviewText(item.excerpt);
}

function resolveShelfKey(createdAt: string, now: Date): SourceShelfSection["key"] {
  const createdAtTime = new Date(createdAt).getTime();
  const diffMs = Math.max(0, now.getTime() - createdAtTime);

  if (diffMs < ONE_DAY_MS) {
    return "recent";
  }

  if (diffMs < SEVEN_DAYS_MS) {
    return "week";
  }

  return "older";
}

function normalizePreviewText(value: string | null) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
