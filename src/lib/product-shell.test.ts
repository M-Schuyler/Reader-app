import assert from "node:assert/strict";
import test from "node:test";
import { ReadState } from "@prisma/client";
import { buildReadingViewHref, getMainNavItems, getPrimaryNavItems, resolveReadingView } from "./product-shell";

test("primary nav keeps search first and link items in product order", () => {
  const items = getPrimaryNavItems({ pathname: "/sources", searchOpen: false });

  assert.deepEqual(
    items.map((item) => [item.id, item.label, item.href, item.isActive]),
    [
      ["search", "搜索", null, false],
      ["sources", "来源库", "/sources", true],
      ["reading", "Reading", "/reading", false],
      ["highlights", "高亮", "/highlights", false],
    ],
  );
});

test("primary nav marks search active when the search panel is open", () => {
  const items = getPrimaryNavItems({ pathname: "/highlights", searchOpen: true });

  assert.equal(items[0]?.id, "search");
  assert.equal(items[0]?.isActive, true);
  assert.equal(items[3]?.isActive, false);
});

test("primary nav marks Reading active for document routes", () => {
  const items = getPrimaryNavItems({ pathname: "/documents/doc-123", searchOpen: false });

  assert.equal(items[2]?.id, "reading");
  assert.equal(items[2]?.isActive, true);
});

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
