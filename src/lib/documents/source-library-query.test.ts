import assert from "node:assert/strict";
import test from "node:test";
import { buildSourceContextChips, buildSourceLibraryClearHref } from "./source-library-query";

test("buildSourceLibraryClearHref keeps search text but clears tag filters", () => {
  assert.equal(
    buildSourceLibraryClearHref("/sources", {
      surface: "source",
      q: "agent",
      tag: "ai",
      type: "WEB_PAGE",
      readState: undefined,
      isFavorite: undefined,
      sort: "latest",
    }),
    "/sources?q=agent",
  );
});

test("buildSourceContextChips includes active tag filters", () => {
  assert.deepEqual(
    buildSourceContextChips({
      surface: "source",
      q: undefined,
      tag: "ai",
      type: undefined,
      readState: undefined,
      isFavorite: undefined,
      sort: "latest",
    }),
    ["标签 ai"],
  );
});
