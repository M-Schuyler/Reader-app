import assert from "node:assert/strict";
import test from "node:test";
import { shouldRenderTextNode } from "./whitespace";

test("renders non-empty text nodes", () => {
  assert.equal(
    shouldRenderTextNode("Reader keeps the text visible.", {
      previous: "none",
      next: "none",
    }),
    true,
  );
});

test("preserves whitespace between inline fragments", () => {
  assert.equal(
    shouldRenderTextNode(" ", {
      previous: "inline",
      next: "text",
    }),
    true,
  );
});

test("drops layout whitespace between block nodes", () => {
  assert.equal(
    shouldRenderTextNode("\n  ", {
      previous: "block",
      next: "block",
    }),
    false,
  );
});

test("drops dangling whitespace without inline siblings", () => {
  assert.equal(
    shouldRenderTextNode(" ", {
      previous: "inline",
      next: "none",
    }),
    false,
  );
});
