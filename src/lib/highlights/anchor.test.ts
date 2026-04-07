import assert from "node:assert/strict";
import test from "node:test";
import { buildTextAnchor, resolveHighlightTextRanges, splitTextByHighlights } from "./anchor";

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

test("resolveHighlightTextRanges keeps explicit offsets and backfills quote-only highlights", () => {
  const ranges = resolveHighlightTextRanges("Alpha beta gamma beta", [
    { id: "offset", quoteText: "beta", startOffset: 6, endOffset: 10 },
    { id: "quote", quoteText: "gamma", startOffset: null, endOffset: null },
  ]);

  assert.deepEqual(ranges, [
    { id: "offset", quoteText: "beta", startOffset: 6, endOffset: 10 },
    { id: "quote", quoteText: "gamma", startOffset: 11, endOffset: 16 },
  ]);
});

test("resolveHighlightTextRanges normalizes quotes, whitespace, and dash runs for imported highlights", () => {
  const sourceText =
    '唯一需要小心的，是那些"不代表未来"的东西。什么是"不代表未来"的东西？一件没有年轻人喜欢的产品------以上都是。';
  const ranges = resolveHighlightTextRanges(sourceText, [
    {
      id: "imported",
      quoteText: "什么是“不代表未来”的东西？一件没有年轻人喜欢的产品——以上都是。",
      startOffset: null,
      endOffset: null,
    },
  ]);

  assert.deepEqual(ranges, [
    {
      id: "imported",
      quoteText: "什么是“不代表未来”的东西？一件没有年轻人喜欢的产品——以上都是。",
      startOffset: sourceText.indexOf('什么是"不代表未来"的东西？'),
      endOffset: sourceText.length,
    },
  ]);
});

test("resolveHighlightTextRanges uses the next available occurrence for repeated quote-only highlights", () => {
  const ranges = resolveHighlightTextRanges("Alpha beta beta", [
    { id: "first", quoteText: "beta", startOffset: null, endOffset: null },
    { id: "second", quoteText: "beta", startOffset: null, endOffset: null },
  ]);

  assert.deepEqual(ranges, [
    { id: "first", quoteText: "beta", startOffset: 6, endOffset: 10 },
    { id: "second", quoteText: "beta", startOffset: 11, endOffset: 15 },
  ]);
});
