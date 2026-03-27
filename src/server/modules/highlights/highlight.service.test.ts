import assert from "node:assert/strict";
import test from "node:test";
import { IngestionStatus } from "@prisma/client";
import {
  parseCreateHighlightInput,
  parseUpdateHighlightInput,
  shouldAllowHighlightCreation,
} from "./highlight.service";

test("parses create highlight input with quote and offsets", () => {
  const input = parseCreateHighlightInput({
    quoteText: "Important sentence",
    startOffset: 32,
    endOffset: 50,
    selectorJson: { exact: "Important sentence" },
  });

  assert.equal(input.quoteText, "Important sentence");
  assert.equal(input.startOffset, 32);
  assert.equal(input.endOffset, 50);
  assert.deepEqual(input.selectorJson, { exact: "Important sentence" });
});

test("rejects empty quote text", () => {
  assert.throws(() => parseCreateHighlightInput({ quoteText: "   " }), /quoteText/i);
});

test("rejects invalid offset ranges", () => {
  assert.throws(
    () =>
      parseCreateHighlightInput({
        quoteText: "Bad",
        startOffset: 20,
        endOffset: 10,
      }),
    /offset/i,
  );
});

test("parses highlight note updates", () => {
  const input = parseUpdateHighlightInput({ note: "Keep this for export." });
  assert.equal(input.note, "Keep this for export.");
});

test("allows highlight creation only for readable documents", () => {
  assert.equal(
    shouldAllowHighlightCreation({
      ingestionStatus: IngestionStatus.READY,
      hasContent: true,
    }),
    true,
  );
  assert.equal(
    shouldAllowHighlightCreation({
      ingestionStatus: IngestionStatus.FAILED,
      hasContent: false,
    }),
    false,
  );
});
