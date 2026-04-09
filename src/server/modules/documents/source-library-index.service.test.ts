import assert from "node:assert/strict";
import test from "node:test";
import {
  getSourceLibraryIndex,
  SOURCE_INDEX_APP_AGGREGATION_WARN_THRESHOLD,
} from "./document.service";
import type { SourceLibraryIndexRow } from "./document.types";

test("source library index uses all matched rows instead of a paginated 20-item slice", async () => {
  const rows = [
    ...Array.from({ length: 20 }, (_, index) =>
      createRow({
        createdAt: "2026-03-10T08:30:00.000Z",
        canonicalUrl: `https://archive-${index}.example.com/article`,
        sourceUrl: `https://archive-${index}.example.com/article`,
      }),
    ),
    createRow({
      createdAt: "2026-03-28T10:30:00.000Z",
      canonicalUrl: "https://recent.example.com/article",
      sourceUrl: "https://recent.example.com/article",
    }),
  ];

  const data = await getSourceLibraryIndex(
    {
      surface: "source",
      page: 1,
      pageSize: 20,
      sort: "latest",
    },
    {
      listSourceIndexRows: async () => ({
        rows,
        total: rows.length,
      }),
      getSourceAliasMapForSources: async () => ({}),
      now: () => new Date("2026-03-28T12:00:00.000Z"),
      warn: () => undefined,
    },
  );

  assert.equal(data.groups.length, 1);
  assert.equal(data.groups[0]?.id, "source:domain:recent.example.com");
});

test("source library index does not warn when matched document count stays under the app aggregation threshold", async () => {
  const warnings: unknown[][] = [];
  const rows = Array.from({ length: SOURCE_INDEX_APP_AGGREGATION_WARN_THRESHOLD }, (_, index) =>
    createRow({
      canonicalUrl: `https://recent-${index}.example.com/article`,
      sourceUrl: `https://recent-${index}.example.com/article`,
    }),
  );

  const data = await getSourceLibraryIndex(
    {
      surface: "source",
      page: 1,
      pageSize: 20,
      sort: "latest",
    },
    {
      listSourceIndexRows: async () => ({
        rows,
        total: rows.length,
      }),
      getSourceAliasMapForSources: async () => ({}),
      now: () => new Date("2026-03-28T12:00:00.000Z"),
      warn: (...args) => warnings.push(args),
    },
  );

  assert.equal(data.groups.length, SOURCE_INDEX_APP_AGGREGATION_WARN_THRESHOLD);
  assert.equal(warnings.length, 0);
});

test("source library index warns once above the app aggregation threshold but does not truncate the result", async () => {
  const warnings: unknown[][] = [];
  const rows = Array.from({ length: SOURCE_INDEX_APP_AGGREGATION_WARN_THRESHOLD + 1 }, (_, index) =>
    createRow({
      canonicalUrl: `https://recent-${index}.example.com/article`,
      sourceUrl: `https://recent-${index}.example.com/article`,
    }),
  );

  const data = await getSourceLibraryIndex(
    {
      surface: "source",
      page: 1,
      pageSize: 20,
      sort: "latest",
    },
    {
      listSourceIndexRows: async () => ({
        rows,
        total: rows.length,
      }),
      getSourceAliasMapForSources: async () => ({}),
      now: () => new Date("2026-03-28T12:00:00.000Z"),
      warn: (...args) => warnings.push(args),
    },
  );

  assert.equal(data.groups.length, SOURCE_INDEX_APP_AGGREGATION_WARN_THRESHOLD + 1);
  assert.equal(warnings.length, 1);
  assert.match(String(warnings[0]?.[0]), /database-level source index aggregation should be the next optimization step/i);
  assert.match(String(warnings[0]?.[0]), /matchedDocumentCount/);
  assert.match(String(warnings[0]?.[0]), new RegExp(String(SOURCE_INDEX_APP_AGGREGATION_WARN_THRESHOLD + 1)));
});

test("source library index returns a dedicated empty state when only older documents exist", async () => {
  const rows = [
    createRow({
      createdAt: "2026-03-10T08:30:00.000Z",
      canonicalUrl: "https://archive.example.com/article",
      sourceUrl: "https://archive.example.com/article",
    }),
  ];

  const data = await getSourceLibraryIndex(
    {
      surface: "source",
      page: 1,
      pageSize: 20,
      sort: "latest",
    },
    {
      listSourceIndexRows: async () => ({
        rows,
        total: rows.length,
      }),
      getSourceAliasMapForSources: async () => ({}),
      now: () => new Date("2026-03-28T12:00:00.000Z"),
      warn: () => undefined,
    },
  );

  assert.equal(data.documentCount, 1);
  assert.equal(data.groups.length, 0);
  assert.equal(data.emptyState, "no_recent_sources");
});

function createRow(overrides: Partial<SourceLibraryIndexRow> = {}): SourceLibraryIndexRow {
  return {
    createdAt: "2026-03-28T08:30:00.000Z",
    sourceUrl: "https://example.com/article",
    canonicalUrl: "https://example.com/article",
    source: null,
    feed: null,
    ...overrides,
  };
}
