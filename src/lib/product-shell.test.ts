import assert from "node:assert/strict";
import test from "node:test";
import { ReadState } from "@prisma/client";
import { buildLibraryViewHref, getMainNavItems, resolveLibraryView } from "./product-shell";

test("marks Library as active for library and document routes", () => {
  const libraryItems = getMainNavItems("/library");
  const documentItems = getMainNavItems("/documents/doc-123");

  assert.equal(libraryItems[0]?.label, "Library");
  assert.equal(libraryItems[0]?.isActive, true);
  assert.equal(documentItems[0]?.isActive, true);
});

test("marks highlights and export as distinct primary surfaces", () => {
  const highlightItems = getMainNavItems("/highlights");
  const exportItems = getMainNavItems("/export");

  assert.deepEqual(
    highlightItems.map((item) => [item.label, item.isActive]),
    [
      ["Library", false],
      ["Highlights", true],
      ["Export", false],
    ],
  );

  assert.deepEqual(
    exportItems.map((item) => [item.label, item.isActive]),
    [
      ["Library", false],
      ["Highlights", false],
      ["Export", true],
    ],
  );
});

test("resolves the default library view as inbox and promotes explicit queue filters", () => {
  assert.equal(resolveLibraryView({}), "inbox");
  assert.equal(resolveLibraryView({ isLater: true }), "later");
  assert.equal(resolveLibraryView({ isFavorite: true }), "starred");
  assert.equal(resolveLibraryView({ readState: ReadState.READ }), "archive");
});

test("builds view hrefs without leaking stale queue filters", () => {
  const href = buildLibraryViewHref("starred", new URLSearchParams("q=claude&sort=published&page=3&isLater=true"));

  assert.equal(href, "/library?q=claude&sort=published&isFavorite=true");
});
