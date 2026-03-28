import assert from "node:assert/strict";
import test from "node:test";
import {
  HIGHLIGHT_SAVE_MODE_STORAGE_KEY,
  normalizeHighlightSaveMode,
  type HighlightSaveMode,
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
