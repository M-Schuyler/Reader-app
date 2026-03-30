import { IngestionJobStatus, SourceKind, SourceSyncMode, Prisma } from "@prisma/client";
import { prisma } from "@/server/db/client";

export const sourceSummaryArgs = Prisma.validator<Prisma.SourceDefaultArgs>()({
  include: {
    feed: {
      select: {
        id: true,
        title: true,
        feedUrl: true,
        siteUrl: true,
        lastSyncedAt: true,
      },
    },
    _count: {
      select: {
        documents: true,
      },
    },
  },
});

export type SourceSummaryRecord = Prisma.SourceGetPayload<typeof sourceSummaryArgs>;

export async function listSources() {
  return prisma.source.findMany({
    ...sourceSummaryArgs,
    orderBy: [
      { lastSyncedAt: { sort: "desc", nulls: "last" } },
      { createdAt: "desc" },
    ],
  });
}

export async function getSourceById(id: string) {
  return prisma.source.findUnique({
    where: { id },
    ...sourceSummaryArgs,
  });
}

export async function findSourceByFeedUrl(feedUrl: string) {
  return prisma.source.findFirst({
    where: {
      kind: SourceKind.RSS,
      feed: {
        is: {
          feedUrl,
        },
      },
    },
    ...sourceSummaryArgs,
  });
}

export async function findSourceByLocatorUrl(locatorUrl: string) {
  return prisma.source.findFirst({
    where: {
      locatorUrl,
    },
    ...sourceSummaryArgs,
  });
}

export async function findSourceBySlug(slug: string) {
  return prisma.source.findUnique({
    where: { slug },
    ...sourceSummaryArgs,
  });
}

export async function createRssSource(input: {
  title: string;
  slug: string;
  locatorUrl: string;
  siteUrl: string | null;
  backfillStartAt: Date | null;
  includeCategories: string[];
  feedTitle: string;
  feedUrl: string;
  feedSiteUrl: string | null;
  syncMode?: SourceSyncMode;
}) {
  return prisma.source.create({
    data: {
      kind: SourceKind.RSS,
      title: input.title,
      slug: input.slug,
      locatorUrl: input.locatorUrl,
      siteUrl: input.siteUrl,
      backfillStartAt: input.backfillStartAt,
      includeCategories: input.includeCategories,
      syncMode: input.syncMode ?? SourceSyncMode.SCHEDULED,
      feed: {
        create: {
          title: input.feedTitle,
          feedUrl: input.feedUrl,
          siteUrl: input.feedSiteUrl,
        },
      },
    },
    ...sourceSummaryArgs,
  });
}

export async function updateSourceSyncState(
  id: string,
  input: {
    lastSyncedAt: Date;
    lastSyncStatus: IngestionJobStatus;
    lastSyncError: string | null;
    siteUrl?: string | null;
  },
) {
  return prisma.source.update({
    where: { id },
    data: {
      lastSyncedAt: input.lastSyncedAt,
      lastSyncStatus: input.lastSyncStatus,
      lastSyncError: input.lastSyncError,
      ...(typeof input.siteUrl !== "undefined" ? { siteUrl: input.siteUrl } : {}),
    },
    ...sourceSummaryArgs,
  });
}

export async function updateFeedMetadata(
  id: string,
  input: {
    title: string;
    siteUrl: string | null;
    lastSyncedAt: Date;
  },
) {
  return prisma.feed.update({
    where: { id },
    data: {
      title: input.title,
      siteUrl: input.siteUrl,
      lastSyncedAt: input.lastSyncedAt,
    },
  });
}

export async function listScheduledRssSources(limit = 10) {
  return prisma.source.findMany({
    where: {
      kind: SourceKind.RSS,
      isActive: true,
      syncMode: SourceSyncMode.SCHEDULED,
      feed: {
        isNot: null,
      },
    },
    ...sourceSummaryArgs,
    orderBy: [
      { lastSyncedAt: { sort: "asc", nulls: "first" } },
      { createdAt: "asc" },
    ],
    take: limit,
  });
}
