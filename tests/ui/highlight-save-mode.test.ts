import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveReaderFontSizePreferenceValue,
  resolveReaderLineHeightPreferenceValue,
  type HighlightSaveMode,
  type ReaderFontSizePreference,
  type ReaderLineHeightPreference,
} from "@/lib/highlights/preferences";

test("highlight save mode type remains a narrow manual or auto union", () => {
  const validModes: HighlightSaveMode[] = ["manual", "auto"];

  assert.deepEqual(validModes, ["manual", "auto"]);
});

test("reader typography preferences normalize invalid values and map to css values", () => {
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
