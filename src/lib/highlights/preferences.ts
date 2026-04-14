export type HighlightSaveMode = "manual" | "auto";

export type ReaderFontSizePreference = "small" | "medium" | "large";
export type ReaderLineHeightPreference = "compact" | "comfortable" | "loose";

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
