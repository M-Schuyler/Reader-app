import assert from "node:assert/strict";
import test from "node:test";
import { buildHighlightOverviewPagination, normalizeHighlightOverviewPage } from "./highlight-overview.service";

test("normalizeHighlightOverviewPage defaults invalid input back to page 1", () => {
  assert.equal(normalizeHighlightOverviewPage(undefined), 1);
  assert.equal(normalizeHighlightOverviewPage(""), 1);
  assert.equal(normalizeHighlightOverviewPage("0"), 1);
  assert.equal(normalizeHighlightOverviewPage("-2"), 1);
  assert.equal(normalizeHighlightOverviewPage("abc"), 1);
});

test("buildHighlightOverviewPagination clamps requested pages into the real range", () => {
  assert.deepEqual(buildHighlightOverviewPagination(380, 1), {
    page: 1,
    pageSize: 50,
    total: 380,
    totalPages: 8,
    skip: 0,
  });

  assert.deepEqual(buildHighlightOverviewPagination(380, 99), {
    page: 8,
    pageSize: 50,
    total: 380,
    totalPages: 8,
    skip: 350,
  });
});
