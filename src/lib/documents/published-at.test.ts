import assert from "node:assert/strict";
import test from "node:test";
import { PublishedAtKind } from "@prisma/client";
import { formatPublishedAtLabel, resolveDocumentDateMetaLabel } from "@/lib/documents/published-at";

test("formatPublishedAtLabel prefers the published date when present", () => {
  assert.equal(
    formatPublishedAtLabel("2026-04-07T08:00:00.000Z", PublishedAtKind.EXACT, "2026-04-06T08:00:00.000Z"),
    "2026年4月7日",
  );
});

test("formatPublishedAtLabel falls back to the import date when publishedAt is missing", () => {
  assert.equal(
    formatPublishedAtLabel(null, PublishedAtKind.UNKNOWN, "2026-04-06T08:00:00.000Z"),
    "导入于 2026年4月6日",
  );
});

test("resolveDocumentDateMetaLabel uses import wording when only the import date is available", () => {
  assert.equal(resolveDocumentDateMetaLabel(null, "2026-04-06T08:00:00.000Z"), "导入时间");
  assert.equal(resolveDocumentDateMetaLabel("2026-04-07T08:00:00.000Z", "2026-04-06T08:00:00.000Z"), "发布时间");
});
