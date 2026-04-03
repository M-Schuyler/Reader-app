import assert from "node:assert/strict";
import test from "node:test";
import {
  HIGHLIGHT_SAVE_MODE_STORAGE_KEY,
  READER_FONT_SIZE_STORAGE_KEY,
  READER_LINE_HEIGHT_STORAGE_KEY,
  normalizeHighlightSaveMode,
  normalizeReaderFontSizePreference,
  normalizeReaderLineHeightPreference,
  resolveReaderFontSizePreferenceValue,
  resolveReaderLineHeightPreferenceValue,
  type HighlightSaveMode,
  type ReaderFontSizePreference,
  type ReaderLineHeightPreference,
} from "@/lib/highlights/preferences";

test("highlight save mode normalizes invalid values and defaults to manual", () => {
  assert.equal(HIGHLIGHT_SAVE_MODE_STORAGE_KEY, "reader-highlight-save-mode");

  assert.equal(normalizeHighlightSaveMode("manual"), "manual");
  assert.equal(normalizeHighlightSaveMode("auto"), "auto");
  assert.equal(normalizeHighlightSaveMode("system"), "manual");
  assert.equal(normalizeHighlightSaveMode(null), "manual");
});

test("highlight save mode type remains a narrow manual or auto union", () => {
  const validModes: HighlightSaveMode[] = ["manual", "auto"];

  assert.deepEqual(validModes, ["manual", "auto"]);
});

test("reader typography preferences normalize invalid values and map to css values", () => {
  assert.equal(READER_FONT_SIZE_STORAGE_KEY, "reader-font-size");
  assert.equal(READER_LINE_HEIGHT_STORAGE_KEY, "reader-line-height");

  assert.equal(normalizeReaderFontSizePreference("small"), "small");
  assert.equal(normalizeReaderFontSizePreference("medium"), "medium");
  assert.equal(normalizeReaderFontSizePreference("large"), "large");
  assert.equal(normalizeReaderFontSizePreference("xlarge"), "medium");

  assert.equal(normalizeReaderLineHeightPreference("compact"), "compact");
  assert.equal(normalizeReaderLineHeightPreference("comfortable"), "comfortable");
  assert.equal(normalizeReaderLineHeightPreference("loose"), "loose");
  assert.equal(normalizeReaderLineHeightPreference("tiny"), "comfortable");

  assert.equal(resolveReaderFontSizePreferenceValue("small"), "1rem");
  assert.equal(resolveReaderFontSizePreferenceValue("medium"), "1.125rem");
  assert.equal(resolveReaderFontSizePreferenceValue("large"), "1.25rem");

  assert.equal(resolveReaderLineHeightPreferenceValue("compact"), "1.75");
  assert.equal(resolveReaderLineHeightPreferenceValue("comfortable"), "2");
  assert.equal(resolveReaderLineHeightPreferenceValue("loose"), "2.2");
});

test("reader typography preference types stay narrow unions", () => {
  const fontSizeValues: ReaderFontSizePreference[] = ["small", "medium", "large"];
  const lineHeightValues: ReaderLineHeightPreference[] = ["compact", "comfortable", "loose"];

  assert.deepEqual(fontSizeValues, ["small", "medium", "large"]);
  assert.deepEqual(lineHeightValues, ["compact", "comfortable", "loose"]);
});
