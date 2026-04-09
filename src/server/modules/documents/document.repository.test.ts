import assert from "node:assert/strict";
import test from "node:test";
import { __documentRepositoryForTests, sourceIndexRowArgs } from "./document.repository";

test("unknown source filter only matches documents with no source, no feed, and no URLs", () => {
  assert.deepEqual(__documentRepositoryForTests.buildDocumentSourceWhere({ kind: "unknown", value: null }), {
    sourceId: null,
    feedId: null,
    sourceUrl: null,
    canonicalUrl: null,
  });
});

test("source index rows only select the lightweight fields needed for homepage aggregation", () => {
  assert.deepEqual(Object.keys(sourceIndexRowArgs.select ?? {}).sort(), [
    "canonicalUrl",
    "createdAt",
    "feed",
    "source",
    "sourceUrl",
  ]);
  assert.equal("title" in (sourceIndexRowArgs.select ?? {}), false);
  assert.equal("excerpt" in (sourceIndexRowArgs.select ?? {}), false);
  assert.equal("content" in (sourceIndexRowArgs.select ?? {}), false);
  assert.equal("tags" in (sourceIndexRowArgs.select ?? {}), false);
});
