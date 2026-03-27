import assert from "node:assert/strict";
import test from "node:test";
import { splitPlainTextIntoHighlightedParagraphs } from "./plain-text";

test("splitPlainTextIntoHighlightedParagraphs preserves paragraph boundaries without highlights", () => {
  const paragraphs = splitPlainTextIntoHighlightedParagraphs("First paragraph.\n\nSecond paragraph.", []);

  assert.equal(paragraphs.length, 2);
  assert.deepEqual(
    paragraphs.map((paragraph) => paragraph.segments.map((segment) => segment.text).join("")),
    ["First paragraph.", "Second paragraph."],
  );
});

test("splitPlainTextIntoHighlightedParagraphs keeps highlights inside their paragraph", () => {
  const paragraphs = splitPlainTextIntoHighlightedParagraphs("First paragraph.\n\nSecond paragraph.", [
    {
      id: "h-1",
      quoteText: "Second",
      startOffset: 18,
      endOffset: 24,
    },
  ]);

  assert.equal(paragraphs.length, 2);
  assert.deepEqual(
    paragraphs[1].segments.map((segment) => ({
      type: segment.type,
      text: segment.text,
      id: "id" in segment ? segment.id : undefined,
    })),
    [
      { type: "highlight", text: "Second", id: "h-1" },
      { type: "text", text: " paragraph.", id: undefined },
    ],
  );
});

test("splitPlainTextIntoHighlightedParagraphs splits cross-paragraph highlights instead of collapsing into one block", () => {
  const sourceText = "First paragraph.\n\nSecond paragraph.";
  const startOffset = sourceText.indexOf("paragraph");
  const endOffset = sourceText.indexOf("Second") + "Second".length;

  const paragraphs = splitPlainTextIntoHighlightedParagraphs(sourceText, [
    {
      id: "h-cross",
      quoteText: sourceText.slice(startOffset, endOffset),
      startOffset,
      endOffset,
    },
  ]);

  assert.equal(paragraphs.length, 2);
  assert.equal(paragraphs[0].segments.some((segment) => segment.type === "highlight"), true);
  assert.equal(paragraphs[1].segments.some((segment) => segment.type === "highlight"), true);
});
