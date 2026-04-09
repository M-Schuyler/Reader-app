import assert from "node:assert/strict";
import test from "node:test";
import { ReadState } from "@prisma/client";
import { buildReadingViewHref, getMainNavItems, resolveReadingView } from "./product-shell";

test("marks 来源库 and Reading as primary surfaces", () => {
  const sourceItems = getMainNavItems("/sources");
  const sourceAllItems = getMainNavItems("/sources/all");
  const sourceUnknownItems = getMainNavItems("/sources/unknown");
  const readingItems = getMainNavItems("/reading");
  const documentItems = getMainNavItems("/documents/doc-123");

  assert.deepEqual(
    sourceItems.map((item) => [item.label, item.isActive]),
    [
      ["来源库", true],
      ["Reading", false],
      ["高亮", false],
      ["导出", false],
    ],
  );

  assert.deepEqual(
    readingItems.map((item) => [item.label, item.isActive]),
    [
      ["来源库", false],
      ["Reading", true],
      ["高亮", false],
      ["导出", false],
    ],
  );

  assert.equal(sourceAllItems[0]?.isActive, true);
  assert.equal(sourceUnknownItems[0]?.isActive, true);
  assert.equal(documentItems[1]?.isActive, true);
});

test("resolves reading views without later semantics", () => {
  assert.equal(resolveReadingView({}), "queue");
  assert.equal(resolveReadingView({ isFavorite: true }), "starred");
  assert.equal(resolveReadingView({ readState: ReadState.READ }), "archive");
});

test("builds reading view hrefs without stale view filters", () => {
  const href = buildReadingViewHref("archive", new URLSearchParams("q=claude&sort=latest&page=2&isFavorite=true"));

  assert.equal(href, "/reading?q=claude&sort=latest&readState=READ");
});
