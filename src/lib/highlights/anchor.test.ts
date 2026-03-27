import assert from "node:assert/strict";
import test from "node:test";
import { buildTextAnchor, splitTextByHighlights } from "./anchor";

test("builds offsets from a selected substring", () => {
  const anchor = buildTextAnchor("Alpha beta gamma", 6, 10);

  assert.equal(anchor.quoteText, "beta");
  assert.equal(anchor.startOffset, 6);
  assert.equal(anchor.endOffset, 10);
  assert.equal(anchor.selectorJson, null);
});

test("splits plain text around highlight ranges", () => {
  const segments = splitTextByHighlights("Alpha beta gamma", [
    { id: "h1", startOffset: 6, endOffset: 10, quoteText: "beta" },
  ]);

  assert.deepEqual(
    segments.map((segment) => segment.type),
    ["text", "highlight", "text"],
  );
  assert.equal(segments[1]?.text, "beta");
});
