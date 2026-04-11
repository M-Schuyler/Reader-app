import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSourceContextChips,
  buildSourceLibraryBrowseHref,
  buildSourceLibraryClearHref,
} from "./source-library-query";

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

test("buildSourceContextChips includes the active content-origin label", () => {
  assert.deepEqual(
    buildSourceContextChips(
      {
        surface: "source",
        q: undefined,
        tag: undefined,
        type: undefined,
        readState: undefined,
        isFavorite: undefined,
        origin: "wechat:biz:MzI0MDg5ODA2NQ==",
        sort: "latest",
      } as never,
      [
        {
          count: 2,
          label: "请辩",
          value: "wechat:biz:MzI0MDg5ODA2NQ==",
        },
      ],
    ),
    ["创作来源 请辩"],
  );
});

test("buildSourceLibraryBrowseHref preserves q type tag and sort when entering all documents", () => {
  assert.equal(
    buildSourceLibraryBrowseHref("/sources/all", {
      surface: "source",
      q: "agent",
      tag: "ai",
      type: "WEB_PAGE",
      sort: "earliest",
      page: 4,
      pageSize: 20,
    }),
    "/sources/all?q=agent&type=WEB_PAGE&tag=ai&sort=earliest",
  );
});

test("buildSourceLibraryBrowseHref drops page when returning to the source index", () => {
  assert.equal(
    buildSourceLibraryBrowseHref("/sources", {
      surface: "source",
      q: "agent",
      tag: "ai",
      type: "WEB_PAGE",
      sort: "latest",
      page: 7,
      pageSize: 50,
    }),
    "/sources?q=agent&type=WEB_PAGE&tag=ai",
  );
});
