import { IngestionStatus } from "@prisma/client";
import type {
  DocumentListItem,
  DocumentListSort,
  SourceLibraryIndexGroup,
  SourceLibraryIndexRow,
} from "@/server/modules/documents/document.types";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export type SourceLibrarySourceKind = "source" | "feed" | "domain" | "unknown";
export type SourceAliasLookup = {
  kind: Exclude<SourceLibrarySourceKind, "unknown" | "source">;
  value: string;
};
export type SourceAliasRecord = SourceAliasLookup & {
  name: string;
};
export type SourceAliasMap = Record<string, string>;

export type SourceLibrarySourceIdentity = {
  id: string;
  label: string;
  defaultLabel: string;
  customLabel: string | null;
  host: string | null;
  kind: SourceLibrarySourceKind;
  value: string | null;
  href: string | null;
  filterSummary?: string | null;
};

export type SourceLibrarySourceContext = SourceLibrarySourceIdentity & {
  latestCreatedAt: string;
  meta: string;
  totalItems: number;
};

type SourceIdentityInput = Pick<SourceLibraryIndexRow, "canonicalUrl" | "feed" | "source" | "sourceUrl">;

// App-layer grouping is acceptable for the current library size. Once matched documents
// regularly exceed the service threshold, the next step is database-level aggregation,
// not expanding this scan further in application code.
export function buildSourceLibraryIndexGroups(
  rows: SourceLibraryIndexRow[],
  now: Date = new Date(),
  aliasMap: SourceAliasMap = {},
  sort: DocumentListSort = "latest",
): SourceLibraryIndexGroup[] {
  const groupedBySource = new Map<string, SourceLibraryIndexGroup>();

  for (const row of rows) {
    const identity = resolveSourceLibrarySourceIdentity(row, aliasMap);
    const group = groupedBySource.get(identity.id);

    if (!group) {
      groupedBySource.set(identity.id, {
        ...identity,
        latestCreatedAt: row.createdAt,
        meta: "1 篇文章",
        totalItems: 1,
      });
      continue;
    }

    if (new Date(row.createdAt).getTime() > new Date(group.latestCreatedAt).getTime()) {
      group.latestCreatedAt = row.createdAt;
    }

    group.totalItems += 1;
    group.meta = `${group.totalItems} 篇文章`;
  }

  return [...groupedBySource.values()]
    .filter((group) => isWithinRecentSevenDays(group.latestCreatedAt, now))
    .sort((left, right) => {
      const direction = sort === "earliest" ? 1 : -1;
      return (new Date(left.latestCreatedAt).getTime() - new Date(right.latestCreatedAt).getTime()) * direction;
    });
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
  aliasMap: SourceAliasMap = {},
): SourceLibrarySourceContext {
  const identity = resolveSourceLibrarySourceIdentity(item, aliasMap);

  return {
    ...identity,
    latestCreatedAt: item.createdAt,
    meta: `${totalItems} 篇文章`,
    totalItems,
  };
}

export function buildSourceAliasMap(aliases: SourceAliasRecord[]): SourceAliasMap {
  return Object.fromEntries(aliases.map((alias) => [buildSourceAliasKey(alias.kind, alias.value), alias.name]));
}

export function collectSourceAliasLookups(items: SourceIdentityInput[]): SourceAliasLookup[] {
  const unique = new Map<string, SourceAliasLookup>();

  for (const item of items) {
    if (item.feed?.id) {
      const lookup = {
        kind: "feed" as const,
        value: item.feed.id,
      };
      unique.set(buildSourceAliasKey(lookup.kind, lookup.value), lookup);
      continue;
    }

    const host = resolveSourceHost(item);
    if (!host) {
      continue;
    }

    const lookup = {
      kind: "domain" as const,
      value: host,
    };
    unique.set(buildSourceAliasKey(lookup.kind, lookup.value), lookup);
  }

  return [...unique.values()];
}

export function buildSourceAliasKey(kind: SourceAliasLookup["kind"], value: string) {
  return `${kind}:${value}`;
}

export function resolveSourceLibrarySourceIdentity(
  item: SourceIdentityInput,
  aliasMap: SourceAliasMap = {},
): SourceLibrarySourceIdentity {
  const explicitSource = getExplicitSourceIdentity(item);
  if (explicitSource) {
    return explicitSource;
  }

  if (item.feed?.title) {
    const defaultLabel = item.feed.title;
    const customLabel = aliasMap[buildSourceAliasKey("feed", item.feed.id)] ?? null;
    return {
      id: `source:feed:${item.feed.id}`,
      label: customLabel ?? defaultLabel,
      defaultLabel,
      customLabel,
      host: resolveSourceHost(item),
      kind: "feed",
      value: item.feed.id,
      href: `/sources/feed/${encodeURIComponent(item.feed.id)}`,
    };
  }

  const host = resolveSourceHost(item);
  if (host) {
    const customLabel = aliasMap[buildSourceAliasKey("domain", host)] ?? null;
    return {
      id: `source:domain:${host}`,
      label: customLabel ?? host,
      defaultLabel: host,
      customLabel,
      host,
      kind: "domain",
      value: host,
      href: `/sources/domain/${encodeURIComponent(host)}`,
    };
  }

  return {
    id: "source:unknown",
    label: "未知来源",
    defaultLabel: "未知来源",
    customLabel: null,
    host: null,
    kind: "unknown",
    value: null,
    href: "/sources/unknown",
  };
}

function getExplicitSourceIdentity(item: SourceIdentityInput): SourceLibrarySourceIdentity | null {
  const source = item.source;

  if (!source?.id || !source.title) {
    return null;
  }

  return {
    id: `source:${source.id}`,
    label: source.title,
    defaultLabel: source.title,
    customLabel: null,
    host: resolveSourceHost(item),
    kind: "source",
    value: source.id,
    href: `/sources/${encodeURIComponent(source.id)}`,
    filterSummary: formatSourceLibraryFilterSummary(source.includeCategories ?? []),
  };
}

function formatSourceLibraryFilterSummary(includeCategories: string[]) {
  if (includeCategories.length === 0) {
    return null;
  }

  if (includeCategories.length <= 2) {
    return `分类过滤 · ${includeCategories.join(", ")}`;
  }

  const [first, second] = includeCategories;
  return `分类过滤 · ${first}, ${second} +${includeCategories.length - 2}`;
}

function resolveSourceHost(item: Pick<SourceIdentityInput, "canonicalUrl" | "sourceUrl">) {
  return parseHostname(item.canonicalUrl) ?? parseHostname(item.sourceUrl);
}

function isWithinRecentSevenDays(createdAt: string, now: Date) {
  const createdAtTime = new Date(createdAt).getTime();
  const diffMs = Math.max(0, now.getTime() - createdAtTime);
  return diffMs < SEVEN_DAYS_MS;
}

function normalizePreviewText(value: string | null) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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
