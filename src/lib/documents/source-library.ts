import { IngestionStatus } from "@prisma/client";
import type { DocumentListItem } from "@/server/modules/documents/document.types";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * ONE_DAY_MS;

export type SourceLibrarySourceKind = "feed" | "domain" | "unknown";

export type SourceLibrarySourceIdentity = {
  id: string;
  label: string;
  host: string | null;
  kind: SourceLibrarySourceKind;
  value: string | null;
  href: string | null;
};

export type SourceLibrarySourceGroup = {
  id: SourceLibrarySourceIdentity["id"];
  label: SourceLibrarySourceIdentity["label"];
  meta: string;
  host: SourceLibrarySourceIdentity["host"];
  latestCreatedAt: string;
  kind: SourceLibrarySourceIdentity["kind"];
  value: SourceLibrarySourceIdentity["value"];
  href: SourceLibrarySourceIdentity["href"];
  items: DocumentListItem[];
};

export type SourceLibrarySourceContext = SourceLibrarySourceIdentity & {
  latestCreatedAt: string;
  meta: string;
  totalItems: number;
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
  const sortedItems = [...items].sort((left, right) => {
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });

  const groupedBySource = new Map<
    string,
    Omit<SourceLibrarySourceGroup, "meta" | "latestCreatedAt" | "items"> & { items: DocumentListItem[] }
  >();

  for (const item of sortedItems) {
    const identity = resolveSourceLibrarySourceIdentity(item);
    const group = groupedBySource.get(identity.id);

    if (group) {
      group.items.push(item);
      continue;
    }

    groupedBySource.set(identity.id, {
      ...identity,
      items: [item],
    });
  }

  const sections: Record<SourceShelfSection["key"], SourceLibrarySourceGroup[]> = {
    recent: [],
    week: [],
    older: [],
  };

  for (const group of groupedBySource.values()) {
    const latestCreatedAt = group.items[0]?.createdAt ?? "";
    const sectionKey = resolveShelfKey(latestCreatedAt, now);

    sections[sectionKey].push({
      ...group,
      latestCreatedAt,
      meta: `${group.items.length} 篇文章`,
    });
  }

  return (Object.keys(SOURCE_SHELF_META) as Array<SourceShelfSection["key"]>)
    .map((key) => ({
      ...SOURCE_SHELF_META[key],
      groups: sections[key],
    }))
    .filter((section) => section.groups.length > 0);
}

export function resolveSourceLibraryPreviewText(item: DocumentListItem) {
  if (item.ingestionStatus === IngestionStatus.FAILED) {
    return null;
  }

  return normalizePreviewText(item.aiSummary) ?? normalizePreviewText(item.excerpt);
}

export function buildSourceLibrarySourceContext(
  item: DocumentListItem,
  totalItems: number,
): SourceLibrarySourceContext {
  const identity = resolveSourceLibrarySourceIdentity(item);

  return {
    ...identity,
    latestCreatedAt: item.createdAt,
    meta: `${totalItems} 篇文章`,
    totalItems,
  };
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

export function resolveSourceLibrarySourceIdentity(item: DocumentListItem): SourceLibrarySourceIdentity {
  if (item.feed?.title) {
    return {
      id: `source:feed:${item.feed.id}`,
      label: item.feed.title,
      host: resolveSourceHost(item),
      kind: "feed",
      value: item.feed.id,
      href: `/sources/feed/${encodeURIComponent(item.feed.id)}`,
    };
  }

  const host = resolveSourceHost(item);
  if (host) {
    return {
      id: `source:domain:${host}`,
      label: host,
      host,
      kind: "domain",
      value: host,
      href: `/sources/domain/${encodeURIComponent(host)}`,
    };
  }

  const fallbackSource = item.canonicalUrl ?? item.sourceUrl ?? item.id;

  return {
    id: `source:url:${fallbackSource}`,
    label: "未知来源",
    host: null,
    kind: "unknown",
    value: null,
    href: null,
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
