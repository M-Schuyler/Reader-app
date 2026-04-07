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
  assert.match(documentReader, /ReaderTypographyControl/);
  assert.match(documentReader, /READER_FONT_SIZE_STORAGE_KEY/);
  assert.match(documentReader, /READER_LINE_HEIGHT_STORAGE_KEY/);
  assert.match(documentReader, /persistReaderFontSize/);
  assert.match(documentReader, /persistReaderLineHeight/);
  assert.match(documentReader, /resolveReaderFontSizePreferenceValue\(readerFontSize\)/);
  assert.match(documentReader, /resolveReaderLineHeightPreferenceValue\(readerLineHeight\)/);
  assert.match(documentReader, /字体大小/);
  assert.match(documentReader, /行距/);
  assert.match(documentReader, /实时预览/);
  assert.match(
    documentReader,
    /今天的阅读，从一个清晰的段落开始。[\s\S]*The interface should stay calm, while the text stays legible and focused\./,
  );
  assert.match(
    documentReader,
    /短句用来确认节奏。[\s\S]*Longer sentences help you feel how spacing affects sustained reading comfort over time\./,
  );
  assert.match(documentReader, /<br \/>/);
  assert.match(documentReader, /style=\{\{ fontSize: previewFontSize, lineHeight: previewLineHeight \}\}/);
  assert.match(documentReader, /onMouseDown=\{handleSelectionMouseDown\}/);
  assert.match(documentReader, /onContextMenu=\{handleSelectionContextMenu\}/);
  assert.match(documentReader, /onMouseUp=\{handleSelectionMouseUp\}/);
  assert.match(documentReader, /event\.button !== 0 \|\| suppressNativeContextMenuRef\.current/);
  assert.match(documentReader, /event\.button !== 2/);
  assert.match(documentReader, /suppressNativeContextMenuRef/);
  assert.match(documentReader, /highlightSaveMode === "auto"/);
  assert.match(documentReader, /selectionState\.trigger === "contextmenu"/);
  assert.match(documentReader, /if \(!selectionState \|\| selectionState\.trigger === "contextmenu"\)/);
  assert.match(documentReader, /handleCreateHighlightNote/);
  assert.match(documentReader, /setSelectionState\(null\);\s*\n\s*}\s*\n\s*\n\s*async function handleCreateHighlight/);
  assert.match(documentReader, /setSelectionState\(null\);\s*\n\s*documentHighlights\.requestHighlightNoteFocus/);
  assert.match(documentReader, /createPortal/);
  assert.match(documentReader, /reader-panel-toggle-slot/);
  assert.match(documentReader, /headerToggleSlot\.setAttribute\("data-panel-open", "true"\)/);
  assert.match(documentReader, /headerToggleSlot\.removeAttribute\("data-panel-open"\)/);
  assert.match(documentReader, /relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-stone-200 bg-transparent/);
  assert.doesNotMatch(documentReader, /fixed right-14 top-4 left-auto bottom-auto z-50/);
  assert.match(documentReader, /LayersIcon/);
  assert.match(documentReader, /documentHighlights\.highlights\.length > 0/);
  assert.doesNotMatch(documentReader, /<span>面板<\/span>/);
  assert.match(documentReader, /FloatingTabButton/);
  assert.match(documentReader, /floatingPanelTab === "highlights"/);
  assert.match(documentReader, /floatingPanelTab === "actions"/);
  assert.match(documentReader, /floatingPanelTab === "meta"/);
  assert.match(documentReader, /ReaderHighlightsPanel/);
  assert.match(documentReader, /fixed right-4 top-\[60px\] z-50/);
  assert.match(documentReader, /max-h-\[calc\(100vh-80px\)\]/);
  assert.doesNotMatch(documentReader, /lg:grid-cols-\[minmax\(0,var\(--content-measure\)\)_17rem\]/);
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
