import assert from "node:assert/strict";
import test from "node:test";
import { RouteError } from "@/server/api/response";
import {
  matchesIncludedCategories,
  normalizeSourceLoadError,
  parseCreateSourceInput,
  parseSourceSyncLimit,
} from "@/server/modules/sources/source.service";

test("parseCreateSourceInput normalizes rss source creation payloads", () => {
  const parsed = parseCreateSourceInput({
    kind: "RSS",
    title: " 请辩 RSS ",
    locatorUrl: "https://example.com/feed.xml#top",
    backfillStartAt: "2026-03-01",
    includeCategories: " Tech, Reviews , , Review ",
  });

  assert.deepEqual(parsed, {
    kind: "RSS",
    title: "请辩 RSS",
    locatorUrl: "https://example.com/feed.xml",
    backfillStartAt: "2026-03-01T00:00:00.000Z",
    includeCategories: ["Tech", "Reviews"],
  });
});

test("parseCreateSourceInput rejects unsupported kinds and invalid urls", () => {
  assert.throws(
    () =>
      parseCreateSourceInput({
        kind: "BLOG",
        title: "Bad source",
        locatorUrl: "https://example.com",
      }),
    (error) => error instanceof RouteError && error.code === "INVALID_BODY",
  );

  assert.throws(
    () =>
      parseCreateSourceInput({
        kind: "RSS",
        title: "Bad source",
        locatorUrl: "javascript:alert(1)",
      }),
    (error) => error instanceof RouteError && error.code === "INVALID_BODY",
  );
});

test("parseSourceSyncLimit accepts positive integers and defaults when omitted", () => {
  assert.equal(parseSourceSyncLimit(null), undefined);
  assert.equal(parseSourceSyncLimit("5"), 5);
});

test("parseSourceSyncLimit rejects zero and invalid input", () => {
  assert.throws(
    () => parseSourceSyncLimit("0"),
    (error) => error instanceof RouteError && error.code === "INVALID_QUERY",
  );

  assert.throws(
    () => parseSourceSyncLimit("abc"),
    (error) => error instanceof RouteError && error.code === "INVALID_QUERY",
  );
});

test("normalizeSourceLoadError preserves existing route errors", () => {
  const error = new RouteError("SOURCE_DISCOVERY_FAILED", 502, "Failed to fetch the source locator URL.");

  assert.equal(normalizeSourceLoadError(error, "locator"), error);
});

test("normalizeSourceLoadError maps locator network failures to a clear discovery error", () => {
  const normalized = normalizeSourceLoadError(new TypeError("fetch failed"), "locator");

  assert.equal(normalized.code, "SOURCE_DISCOVERY_FAILED");
  assert.equal(normalized.status, 502);
  assert.equal(normalized.message, "Failed to fetch the source locator URL.");
});

test("normalizeSourceLoadError maps missing feeds to a clear discovery error", () => {
  const normalized = normalizeSourceLoadError(new Error("No RSS or Atom feed was discovered from the provided locator."), "locator");

  assert.equal(normalized.code, "SOURCE_DISCOVERY_FAILED");
  assert.equal(normalized.status, 422);
  assert.equal(normalized.message, "No RSS or Atom feed could be discovered from the provided URL.");
});

test("normalizeSourceLoadError maps invalid feed documents to a parse failure", () => {
  const normalized = normalizeSourceLoadError(new Error("The fetched document is not a valid RSS or Atom feed."), "feed");

  assert.equal(normalized.code, "FEED_FETCH_FAILED");
  assert.equal(normalized.status, 422);
  assert.equal(normalized.message, "The RSS feed could not be parsed.");
});

test("matchesIncludedCategories applies exact category filters with case-insensitive singular matching", () => {
  assert.equal(matchesIncludedCategories(["Tech", "AI"], ["tech"]), true);
  assert.equal(matchesIncludedCategories(["Reviews"], ["Review"]), true);
  assert.equal(matchesIncludedCategories(["Review"], ["Reviews"]), true);
  assert.equal(matchesIncludedCategories(["Phone Reviews"], ["Review"]), false);
  assert.equal(matchesIncludedCategories(["Games Review"], ["Review"]), false);
  assert.equal(matchesIncludedCategories(["AI"], ["Review"]), false);
  assert.equal(matchesIncludedCategories(["AI"], []), true);
});
