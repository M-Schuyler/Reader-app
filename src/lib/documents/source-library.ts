import { IngestionStatus } from "@prisma/client";
import type { DocumentListItem } from "@/server/modules/documents/document.types";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * ONE_DAY_MS;

export type SourceLibrarySourceGroup = {
  id: string;
  label: string;
  meta: string;
  host: string | null;
  latestCreatedAt: string;
  sourceKind: "feed" | "domain" | "unknown";
  items: DocumentListItem[];
};

export type SourceShelfSection = {
  key: "recent" | "week" | "older";
  label: string;
  description: string;
  groups: SourceLibrarySourceGroup[];
};

const SOURCE_SHELF_META: Record<SourceShelfSection["key"], Omit<SourceShelfSection, "groups">> = {
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
  const sections: Record<SourceShelfSection["key"], Map<string, Omit<SourceLibrarySourceGroup, "meta" | "latestCreatedAt">>> = {
    recent: new Map(),
    week: new Map(),
    older: new Map(),
  };

  const sortedItems = [...items].sort((left, right) => {
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });

  for (const item of sortedItems) {
    const sectionKey = resolveShelfKey(item.createdAt, now);
    const identity = resolveSourceIdentity(item);
    const group = sections[sectionKey].get(identity.id);

    if (group) {
      group.items.push(item);
      continue;
    }

    sections[sectionKey].set(identity.id, {
      ...identity,
      items: [item],
    });
  }

  return (Object.keys(SOURCE_SHELF_META) as Array<SourceShelfSection["key"]>)
    .map((key) => ({
      ...SOURCE_SHELF_META[key],
      groups: Array.from(sections[key].values()).map((group) => ({
        ...group,
        latestCreatedAt: group.items[0]?.createdAt ?? "",
        meta: `${group.items.length} 篇文章`,
      })),
    }))
    .filter((section) => section.groups.length > 0);
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

function resolveSourceIdentity(
  item: DocumentListItem,
): Omit<SourceLibrarySourceGroup, "meta" | "latestCreatedAt" | "items"> {
  if (item.feed?.title) {
    return {
      id: `source:feed:${item.feed.id}`,
      label: item.feed.title,
      host: resolveSourceHost(item),
      sourceKind: "feed",
    };
  }

  const host = resolveSourceHost(item);
  if (host) {
    return {
      id: `source:domain:${host}`,
      label: host,
      host,
      sourceKind: "domain",
    };
  }

  const fallbackSource = item.canonicalUrl ?? item.sourceUrl ?? item.id;

  return {
    id: `source:url:${fallbackSource}`,
    label: "未知来源",
    host: null,
    sourceKind: "unknown",
  };
}

function resolveSourceHost(item: Pick<DocumentListItem, "canonicalUrl" | "sourceUrl">) {
  return parseHostname(item.canonicalUrl) ?? parseHostname(item.sourceUrl);
}

function parseHostname(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
}
