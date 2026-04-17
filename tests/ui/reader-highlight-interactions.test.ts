import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readWorkspaceFile(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("reader swaps the old save banner for mode-aware selection actions", () => {
  const documentReader = readWorkspaceFile("src/components/reader/document-reader.tsx");

  assert.doesNotMatch(documentReader, /把这段文字保存为高亮，方便稍后回看/);
  assert.match(documentReader, /resolveReaderFontSizePreferenceValue\(readerFontSize\)/);
  assert.match(documentReader, /resolveReaderLineHeightPreferenceValue\(readerLineHeight\)/);
  assert.match(documentReader, /useReaderSelection/);
  assert.match(documentReader, /floatingPanelTab/);
});

test("reader highlights panel opens modal note editor and keeps save flow", () => {
  const readerHighlights = readWorkspaceFile("src/components/reader/reader-highlights.tsx");

  assert.match(readerHighlights, /focusedHighlightId/);
  assert.match(readerHighlights, /requestHighlightNoteFocus/);
  assert.match(readerHighlights, /return payload\.data\.highlight/);
  assert.match(readerHighlights, /openNoteEditor/);
  assert.match(readerHighlights, /closeNoteEditor/);
  assert.match(readerHighlights, /aria-modal="true"/);
  assert.match(readerHighlights, /role="dialog"/);
  assert.match(readerHighlights, /onMouseDown=\{handleTriggerMouseDown\}/);
  assert.match(readerHighlights, /readOnly/);
  assert.match(readerHighlights, /handleConfirmNoteSave/);
  assert.match(readerHighlights, /scrollIntoView/);
});

test("reader rich content resolves imported quote-only highlights back into inline marks", () => {
  const richContent = readWorkspaceFile("src/components/reader/reader-rich-content.tsx");

  assert.match(richContent, /resolveHighlightTextRanges/);
  assert.match(richContent, /const resolvedHighlights = resolveHighlightTextRanges/);
});
