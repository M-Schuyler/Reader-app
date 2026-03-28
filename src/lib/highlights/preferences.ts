export type HighlightSaveMode = "manual" | "auto";

export const HIGHLIGHT_SAVE_MODE_STORAGE_KEY = "reader-highlight-save-mode";

export function normalizeHighlightSaveMode(value: string | null | undefined): HighlightSaveMode {
  if (value === "manual" || value === "auto") {
    return value;
  }

  return "manual";
}

export function readHighlightSaveMode(storageValue: string | null | undefined) {
  return normalizeHighlightSaveMode(storageValue);
}
