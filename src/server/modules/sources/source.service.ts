import {
  IngestionJobKind,
  IngestionJobStatus,
  IngestionStatus,
  PublishedAtKind,
  SourceKind,
} from "@prisma/client";
import { RouteError } from "@/server/api/response";
import { prisma } from "@/server/db/client";
import {
  createRssDocument,
  findRssDocumentByExternalId,
  findRssDocumentByTitleAndTextHash,
  findRssDocumentByUrlCandidates,
} from "@/server/modules/documents/document.repository";
import {
  createRssSource,
  findSourceByFeedUrl,
  findSourceByLocatorUrl,
  findSourceBySlug,
  getSourceById,
  listScheduledRssSources,
  listSources,
  type SourceSummaryRecord,
  updateFeedMetadata,
  updateSourceSyncState,
} from "@/server/modules/sources/source.repository";
import { discoverFeedFromResponse, parseFeedDocument } from "@/server/modules/sources/source-rss";
import type {
  CreateSourceInput,
  CreateSourceResponseData,
  GetSourceResponseData,
  GetSourcesResponseData,
  RunSourceSyncsResponseData,
  SourceSummary,
  SourceSyncError,
  SourceSyncResult,
  SyncSourceResponseData,
} from "@/server/modules/sources/source.types";

export async function getSources(): Promise<GetSourcesResponseData> {
  const items = await listSources();
  return {
    items: items.map(mapSourceSummary),
  };
}

export async function getSource(id: string): Promise<GetSourceResponseData | null> {
  const source = await getSourceById(id);
  if (!source) {
    return null;
  }

  return {
    source: mapSourceSummary(source),
  };
}

export async function createSource(input: CreateSourceInput): Promise<CreateSourceResponseData> {
  if (input.kind !== SourceKind.RSS) {
    throw new RouteError("SOURCE_KIND_NOT_SUPPORTED", 422, "This source type is defined but not yet available in v1.");
  }

  const resolved = await resolveFeedLocator(input.locatorUrl);
  const existing = (await findSourceByFeedUrl(resolved.feedUrl)) ?? (await findSourceByLocatorUrl(input.locatorUrl));
  if (existing) {
    return {
      source: mapSourceSummary(existing),
      deduped: true,
      sync: null,
    };
  }

  const source = await createRssSource({
    title: input.title,
    slug: await buildUniqueSourceSlug(input.title),
    locatorUrl: input.locatorUrl,
    siteUrl: resolved.siteUrl,
    backfillStartAt: parseOptionalDate(input.backfillStartAt),
    includeCategories: input.includeCategories,
    feedTitle: resolved.feed.title,
    feedUrl: resolved.feedUrl,
    feedSiteUrl: resolved.feed.siteUrl,
  });
  const sync = await syncRssSource(source.id);
  const refreshed = await getSourceById(source.id);

  if (!refreshed) {
    throw new RouteError("SOURCE_NOT_FOUND", 500, "Source was created but could not be reloaded.");
  }

  return {
    source: mapSourceSummary(refreshed),
    deduped: false,
    sync,
  };
}

export async function syncSource(id: string): Promise<SyncSourceResponseData | null> {
  const source = await getSourceById(id);
  if (!source) {
    return null;
  }

  const sync = await syncRssSource(source.id);
  const refreshed = await getSourceById(source.id);

  if (!refreshed) {
    throw new RouteError("SOURCE_NOT_FOUND", 500, "Source could not be reloaded after sync.");
  }

  return {
    source: mapSourceSummary(refreshed),
    sync,
  };
}

export async function runScheduledSourceSyncs(limit?: number): Promise<RunSourceSyncsResponseData> {
  const sources = await listScheduledRssSources(limit ?? 10);
  const results: RunSourceSyncsResponseData["results"] = [];
  let succeeded = 0;
  let failed = 0;

  for (const source of sources) {
    try {
      const sync = await syncRssSource(source.id);
      results.push({
        sourceId: source.id,
        title: source.title,
        sync,
      });
      if (sync.error) {
        failed += 1;
      } else {
        succeeded += 1;
      }
    } catch (error) {
      failed += 1;
      results.push({
        sourceId: source.id,
        title: source.title,
        sync: {
          jobId: "",
          importedCount: 0,
          skippedCount: 0,
          failedCount: 0,
          dedupedByExternalIdCount: 0,
          dedupedByUrlCount: 0,
          dedupedByContentCount: 0,
          error: toSourceSyncError(error),
        },
      });
    }
  }

  return {
    processed: sources.length,
    succeeded,
    failed,
    skipped: 0,
    results,
  };
}

export function parseCreateSourceInput(body: unknown): CreateSourceInput {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new RouteError("INVALID_BODY", 400, "Request body must be a JSON object.");
  }

  const kind = (body as { kind?: unknown }).kind;
  const title = (body as { title?: unknown }).title;
  const locatorUrl = (body as { locatorUrl?: unknown }).locatorUrl;
  const backfillStartAt = (body as { backfillStartAt?: unknown }).backfillStartAt;
  const includeCategories = (body as { includeCategories?: unknown }).includeCategories;

  if (kind !== SourceKind.RSS && kind !== SourceKind.WECHAT_ARCHIVE) {
    throw new RouteError("INVALID_BODY", 400, '"kind" must be "RSS" or "WECHAT_ARCHIVE".');
  }

  if (typeof title !== "string" || title.trim().length === 0) {
    throw new RouteError("INVALID_BODY", 400, '"title" must be a non-empty string.');
  }

  const normalizedLocatorUrl = normalizeLocatorUrl(locatorUrl);
  const normalizedBackfillStartAt =
    typeof backfillStartAt === "undefined" || backfillStartAt === null || backfillStartAt === ""
      ? null
      : normalizeBackfillStartAt(backfillStartAt);

  return {
    kind,
    title: title.trim(),
    locatorUrl: normalizedLocatorUrl,
    backfillStartAt: normalizedBackfillStartAt,
    includeCategories: normalizeIncludeCategories(includeCategories),
  };
}

export function parseSourceSyncLimit(value: string | null) {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    throw new RouteError("INVALID_QUERY", 400, '"limit" must be a positive integer.');
  }

  return parsed;
}

export function normalizeSourceLoadError(error: unknown, stage: "locator" | "feed") {
  if (error instanceof RouteError) {
    return error;
  }

  if (isNetworkFetchError(error)) {
    return stage === "locator"
      ? new RouteError("SOURCE_DISCOVERY_FAILED", 502, "Failed to fetch the source locator URL.")
      : new RouteError("FEED_FETCH_FAILED", 502, "Failed to fetch the RSS feed.");
  }

  return stage === "locator"
    ? new RouteError("SOURCE_DISCOVERY_FAILED", 422, "No RSS or Atom feed could be discovered from the provided URL.")
    : new RouteError("FEED_FETCH_FAILED", 422, "The RSS feed could not be parsed.");
}

export function matchesIncludedCategories(entryCategories: string[], includeCategories: string[]) {
  if (includeCategories.length === 0) {
    return true;
  }

  const entryKeys = new Set(entryCategories.map(normalizeCategoryMatchKey).filter((value): value is string => Boolean(value)));

  return includeCategories.some((category) => {
    const key = normalizeCategoryMatchKey(category);
    return key ? entryKeys.has(key) : false;
  });
}

async function syncRssSource(sourceId: string): Promise<SourceSyncResult> {
  const source = await getSourceById(sourceId);
  if (!source) {
    throw new RouteError("SOURCE_NOT_FOUND", 404, "Source was not found.");
  }

  if (source.kind !== SourceKind.RSS || !source.feed) {
    throw new RouteError("SOURCE_KIND_NOT_SUPPORTED", 422, "This source cannot be synced by the RSS pipeline.");
  }

  const job = await prisma.ingestionJob.create({
    data: {
      kind: IngestionJobKind.SYNC_FEED,
      status: IngestionJobStatus.PENDING,
      sourceId: source.id,
      feedId: source.feed.id,
      sourceUrl: source.feed.feedUrl,
    },
  });

  try {
    await prisma.ingestionJob.update({
      where: { id: job.id },
      data: {
        status: IngestionJobStatus.PROCESSING,
        startedAt: new Date(),
      },
    });

    const fetched = await fetchFeed(source.feed.feedUrl);
    let parsed;
    try {
      parsed = parseFeedDocument({
        feedUrl: source.feed.feedUrl,
        xml: fetched.body,
      });
    } catch (error) {
      throw normalizeSourceLoadError(error, "feed");
    }
    const syncAt = new Date();
    let importedCount = 0;
    let skippedCount = 0;
    let dedupedByExternalIdCount = 0;
    let dedupedByUrlCount = 0;
    let dedupedByContentCount = 0;

    await updateFeedMetadata(source.feed.id, {
      title: parsed.title,
      siteUrl: parsed.siteUrl,
      lastSyncedAt: syncAt,
    });

    for (const entry of parsed.entries) {
      if (!matchesIncludedCategories(entry.categories, source.includeCategories)) {
        skippedCount += 1;
        continue;
      }

      if (source.backfillStartAt && entry.publishedAt && entry.publishedAt < source.backfillStartAt) {
        skippedCount += 1;
        continue;
      }

      const existing = await findRssDocumentByExternalId(source.feed.id, entry.externalId);
      if (existing) {
        skippedCount += 1;
        dedupedByExternalIdCount += 1;
        continue;
      }

      const dedupeUrlCandidates = entry.dedupeUrl ? [entry.dedupeUrl] : [];
      if (dedupeUrlCandidates.length > 0) {
        const existingByUrl = await findRssDocumentByUrlCandidates(source.feed.id, dedupeUrlCandidates);
        if (existingByUrl) {
          skippedCount += 1;
          dedupedByUrlCount += 1;
          continue;
        }
      }

      const existingByContent = await findRssDocumentByTitleAndTextHash(source.feed.id, entry.title, entry.textHash);
      if (existingByContent) {
        skippedCount += 1;
        dedupedByContentCount += 1;
        continue;
      }

      await createRssDocument({
        sourceId: source.id,
        feedId: source.feed.id,
        title: entry.title,
        sourceUrl: entry.url,
        canonicalUrl: entry.url,
        externalId: entry.externalId,
        lang: parsed.lang,
        excerpt: entry.excerpt,
        author: entry.author,
        publishedAt: entry.publishedAt,
        publishedAtKind: entry.publishedAt ? PublishedAtKind.EXACT : PublishedAtKind.UNKNOWN,
        ingestionStatus: IngestionStatus.READY,
        contentHtml: entry.contentHtml,
        plainText: entry.plainText,
        rawHtml: entry.contentHtml,
        textHash: entry.textHash,
        wordCount: countReadableUnits(entry.plainText),
        extractedAt: syncAt,
      });

      importedCount += 1;
    }

    await updateSourceSyncState(source.id, {
      lastSyncedAt: syncAt,
      lastSyncStatus: IngestionJobStatus.SUCCEEDED,
      lastSyncError: null,
      siteUrl: parsed.siteUrl ?? source.siteUrl,
    });

    await prisma.ingestionJob.update({
      where: { id: job.id },
      data: {
        status: IngestionJobStatus.SUCCEEDED,
        finishedAt: syncAt,
        payloadJson: {
          importedCount,
          skippedCount,
          dedupedByExternalIdCount,
          dedupedByUrlCount,
          dedupedByContentCount,
          feedTitle: parsed.title,
        },
      },
    });

    return {
      jobId: job.id,
      importedCount,
      skippedCount,
      failedCount: 0,
      dedupedByExternalIdCount,
      dedupedByUrlCount,
      dedupedByContentCount,
      error: null,
    };
  } catch (error) {
    const syncAt = new Date();
    const syncError = toSourceSyncError(error);

    await updateSourceSyncState(source.id, {
      lastSyncedAt: syncAt,
      lastSyncStatus: IngestionJobStatus.FAILED,
      lastSyncError: syncError.message,
    });

    await prisma.ingestionJob.update({
      where: { id: job.id },
      data: {
        status: IngestionJobStatus.FAILED,
        errorMessage: syncError.message,
        finishedAt: syncAt,
        payloadJson: {
          error: syncError,
        },
      },
    });

    return {
      jobId: job.id,
      importedCount: 0,
      skippedCount: 0,
      failedCount: 1,
      dedupedByExternalIdCount: 0,
      dedupedByUrlCount: 0,
      dedupedByContentCount: 0,
      error: syncError,
    };
  }
}

async function resolveFeedLocator(locatorUrl: string) {
  try {
    const locatorResponse = await fetch(locatorUrl, {
      cache: "no-store",
      headers: {
        "user-agent": "reader-app/0.1",
        accept: "text/html,application/xhtml+xml,application/xml,text/xml,application/rss+xml,application/atom+xml;q=0.9,*/*;q=0.8",
      },
    });

    if (!locatorResponse.ok) {
      throw new RouteError("SOURCE_DISCOVERY_FAILED", 502, "Failed to fetch the source locator URL.");
    }

    const locatorBody = await locatorResponse.text();
    const discovered = discoverFeedFromResponse({
      requestUrl: locatorUrl,
      responseUrl: locatorResponse.url || locatorUrl,
      contentType: locatorResponse.headers.get("content-type"),
      body: locatorBody,
    });
    const feedBody =
      discovered.feedUrl === (locatorResponse.url || locatorUrl) ? locatorBody : (await fetchFeed(discovered.feedUrl)).body;
    const feed = parseFeedDocument({
      feedUrl: discovered.feedUrl,
      xml: feedBody,
    });

    return {
      feedUrl: discovered.feedUrl,
      siteUrl: feed.siteUrl ?? discovered.siteUrl,
      feed,
    };
  } catch (error) {
    throw normalizeSourceLoadError(error, "locator");
  }
}

async function fetchFeed(feedUrl: string) {
  try {
    const response = await fetch(feedUrl, {
      cache: "no-store",
      headers: {
        "user-agent": "reader-app/0.1",
        accept: "application/rss+xml,application/atom+xml,application/xml,text/xml,*/*;q=0.8",
      },
    });

    if (!response.ok) {
      throw new RouteError("FEED_FETCH_FAILED", 502, "Failed to fetch the RSS feed.");
    }

    return {
      url: response.url || feedUrl,
      body: await response.text(),
      contentType: response.headers.get("content-type"),
    };
  } catch (error) {
    throw normalizeSourceLoadError(error, "feed");
  }
}

async function buildUniqueSourceSlug(title: string) {
  const baseSlug = slugify(title) || "source";
  let candidate = baseSlug;
  let attempt = 1;

  while (await findSourceBySlug(candidate)) {
    attempt += 1;
    candidate = `${baseSlug}-${attempt}`;
  }

  return candidate;
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

function normalizeLocatorUrl(value: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new RouteError("INVALID_BODY", 400, '"locatorUrl" must be a non-empty string.');
  }

  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    throw new RouteError("INVALID_BODY", 400, '"locatorUrl" must be a valid absolute URL.');
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new RouteError("INVALID_BODY", 400, '"locatorUrl" must use http or https.');
  }

  parsed.hash = "";
  return parsed.toString();
}

function normalizeBackfillStartAt(value: unknown) {
  if (typeof value !== "string") {
    throw new RouteError("INVALID_BODY", 400, '"backfillStartAt" must be a date string when provided.');
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = parseOptionalDate(trimmed);
  if (!parsed) {
    throw new RouteError("INVALID_BODY", 400, '"backfillStartAt" must be a valid ISO date or YYYY-MM-DD string.');
  }

  return parsed.toISOString();
}

function normalizeIncludeCategories(value: unknown) {
  if (typeof value === "undefined" || value === null || value === "") {
    return [];
  }

  const rawValues =
    typeof value === "string"
      ? value.split(/[\n,，]/g)
      : Array.isArray(value)
        ? value
        : null;

  if (!rawValues) {
    throw new RouteError("INVALID_BODY", 400, '"includeCategories" must be a comma-separated string or string array when provided.');
  }

  const seen = new Set<string>();
  const categories: string[] = [];

  for (const item of rawValues) {
    if (typeof item !== "string") {
      throw new RouteError("INVALID_BODY", 400, '"includeCategories" must contain only strings.');
    }

    const label = item.replace(/\s+/g, " ").trim();
    const matchKey = normalizeCategoryMatchKey(label);
    if (!label || !matchKey || seen.has(matchKey)) {
      continue;
    }

    seen.add(matchKey);
    categories.push(label);
  }

  return categories;
}

function parseOptionalDate(value: string | null) {
  if (!value) {
    return null;
  }

  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00.000Z` : value;
  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeCategoryMatchKey(value: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase().replace(/\s+/g, " ");
  if (!normalized) {
    return null;
  }

  if (normalized === "review" || normalized === "reviews") {
    return "review";
  }

  return normalized;
}

function countReadableUnits(text: string) {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return 0;
  }

  const cjkCharacters = normalized.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu)?.length ?? 0;
  const latinTokens = normalized.match(/[A-Za-z0-9]+(?:[._'’-][A-Za-z0-9]+)*/g)?.length ?? 0;

  return cjkCharacters + latinTokens;
}

function isNetworkFetchError(error: unknown) {
  return error instanceof TypeError || (error instanceof Error && /fetch failed/i.test(error.message));
}

function mapSourceSummary(record: SourceSummaryRecord): SourceSummary {
  return {
    id: record.id,
    kind: record.kind,
    title: record.title,
    slug: record.slug,
    siteUrl: record.siteUrl,
    locatorUrl: record.locatorUrl,
    includeCategories: record.includeCategories,
    isActive: record.isActive,
    syncMode: record.syncMode,
    backfillStartAt: record.backfillStartAt?.toISOString() ?? null,
    lastSyncedAt: record.lastSyncedAt?.toISOString() ?? null,
    lastSyncStatus: record.lastSyncStatus,
    lastSyncError: record.lastSyncError,
    documentCount: record._count.documents,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    feed: record.feed
      ? {
          id: record.feed.id,
          title: record.feed.title,
          feedUrl: record.feed.feedUrl,
          siteUrl: record.feed.siteUrl,
          lastSyncedAt: record.feed.lastSyncedAt?.toISOString() ?? null,
        }
      : null,
  };
}

function toSourceSyncError(error: unknown): SourceSyncError {
  if (error instanceof RouteError) {
    return {
      code: error.code,
      message: error.message,
    };
  }

  if (error instanceof Error && error.message) {
    return {
      code: "SOURCE_SYNC_FAILED",
      message: error.message,
    };
  }

  return {
    code: "SOURCE_SYNC_FAILED",
    message: "Failed to sync the source.",
  };
}
