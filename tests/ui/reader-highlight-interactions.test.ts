import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readWorkspaceFile(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("reader swaps the old save banner for mode-aware selection actions", () => {
  const documentReader = readWorkspaceFile("src/components/reader/document-reader.tsx");

  assert.doesNotMatch(documentReader, /把这段文字保存为高亮，方便稍后回看/);
  assert.match(documentReader, /HighlightSaveModeToggle/);
  assert.match(documentReader, /onContextMenu=\{handleSelectionContextMenu\}/);
  assert.match(documentReader, /highlightSaveMode === "auto"/);
  assert.match(documentReader, /handleCreateHighlightNote/);
});

test("reader highlights hook and panel support focusing a freshly created note target", () => {
  const readerHighlights = readWorkspaceFile("src/components/reader/reader-highlights.tsx");

  assert.match(readerHighlights, /focusedHighlightId/);
  assert.match(readerHighlights, /requestHighlightNoteFocus/);
  assert.match(readerHighlights, /return payload\.data\.highlight/);
  assert.match(readerHighlights, /autoFocusNote/);
  assert.match(readerHighlights, /scrollIntoView/);
});
