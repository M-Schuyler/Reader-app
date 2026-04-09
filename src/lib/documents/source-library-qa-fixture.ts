import { buildSourceLibraryIndexGroups } from "@/lib/documents/source-library";
import type { GetSourceLibraryIndexResponseData, SourceLibraryIndexRow } from "@/server/modules/documents/document.types";

export function getSourceLibraryQaFixture(): GetSourceLibraryIndexResponseData {
  const now = new Date();
  const recent = isoHoursAgo(now, 6);
  const recentEarlier = isoHoursAgo(now, 10);
  const recentFailed = isoHoursAgo(now, 14);
  const thisWeek = isoDaysAgo(now, 3);
  const older = isoDaysAgo(now, 16);
  const rows: SourceLibraryIndexRow[] = [
    {
      createdAt: recent,
      canonicalUrl: "https://mp.weixin.qq.com/s/short-title-demo",
      sourceUrl: "https://mp.weixin.qq.com/s/short-title-demo",
      source: null,
      feed: {
        id: "feed-kai-money",
        title: "Kai Dispatch",
      },
    },
    {
      createdAt: recentEarlier,
      canonicalUrl: "https://mp.weixin.qq.com/s/very-long-title-demo",
      sourceUrl: "https://mp.weixin.qq.com/s/very-long-title-demo",
      source: null,
      feed: {
        id: "feed-kai-money",
        title: "Kai Dispatch",
      },
    },
    {
      createdAt: recentFailed,
      canonicalUrl: "https://example.com/failed-story",
      sourceUrl: "https://example.com/failed-story",
      source: null,
      feed: null,
    },
    {
      createdAt: thisWeek,
      canonicalUrl: "https://sspai.com/post/98765",
      sourceUrl: "https://sspai.com/post/98765",
      source: null,
      feed: null,
    },
    {
      createdAt: older,
      canonicalUrl: "https://archive.example.com/library/older-story",
      sourceUrl: "https://archive.example.com/library/older-story",
      source: null,
      feed: {
        id: "feed-archive",
        title: "Archive Notes",
      },
    },
  ];

  return {
    groups: buildSourceLibraryIndexGroups(rows, now),
    documentCount: rows.length,
    filters: {
      surface: "source",
      sort: "latest",
    },
    emptyState: null,
  };
}

function isoHoursAgo(now: Date, hours: number) {
  return new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();
}

function isoDaysAgo(now: Date, days: number) {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}
