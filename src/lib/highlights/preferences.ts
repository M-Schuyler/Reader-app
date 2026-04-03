export type HighlightSaveMode = "manual" | "auto";

export const HIGHLIGHT_SAVE_MODE_STORAGE_KEY = "reader-highlight-save-mode";

export type ReaderFontSizePreference = "small" | "medium" | "large";
export type ReaderLineHeightPreference = "compact" | "comfortable" | "loose";

export const READER_FONT_SIZE_STORAGE_KEY = "reader-font-size";
export const READER_LINE_HEIGHT_STORAGE_KEY = "reader-line-height";

export function normalizeHighlightSaveMode(value: string | null | undefined): HighlightSaveMode {
  if (value === "manual" || value === "auto") {
    return value;
  }

  return "manual";
}

export function readHighlightSaveMode(storageValue: string | null | undefined) {
  return normalizeHighlightSaveMode(storageValue);
}

export function normalizeReaderFontSizePreference(value: string | null | undefined): ReaderFontSizePreference {
  if (value === "small" || value === "medium" || value === "large") {
    return value;
  }

  return "medium";
}

export function normalizeReaderLineHeightPreference(value: string | null | undefined): ReaderLineHeightPreference {
  if (value === "compact" || value === "comfortable" || value === "loose") {
    return value;
  }

  return "comfortable";
}

export function readReaderFontSizePreference(storageValue: string | null | undefined) {
  return normalizeReaderFontSizePreference(storageValue);
}

export function readReaderLineHeightPreference(storageValue: string | null | undefined) {
  return normalizeReaderLineHeightPreference(storageValue);
}

export function resolveReaderFontSizePreferenceValue(value: ReaderFontSizePreference) {
  switch (value) {
    case "small":
      return "1rem";
    case "large":
      return "1.25rem";
    case "medium":
    default:
      return "1.125rem";
  }
}

export function resolveReaderLineHeightPreferenceValue(value: ReaderLineHeightPreference) {
  switch (value) {
    case "compact":
      return "1.75";
    case "loose":
      return "2.2";
    case "comfortable":
    default:
      return "2";
  }
}
