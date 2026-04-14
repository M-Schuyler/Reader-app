import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  HighlightSaveMode,
  ReaderFontSizePreference,
  ReaderLineHeightPreference,
} from "./preferences";

interface ReaderPreferencesState {
  highlightSaveMode: HighlightSaveMode;
  readerFontSize: ReaderFontSizePreference;
  readerLineHeight: ReaderLineHeightPreference;
  setHighlightSaveMode: (mode: HighlightSaveMode) => void;
  setReaderFontSize: (size: ReaderFontSizePreference) => void;
  setReaderLineHeight: (height: ReaderLineHeightPreference) => void;
}

export const useReaderPreferences = create<ReaderPreferencesState>()(
  persist(
    (set) => ({
      highlightSaveMode: "manual",
      readerFontSize: "medium",
      readerLineHeight: "comfortable",
      setHighlightSaveMode: (mode) => set({ highlightSaveMode: mode }),
      setReaderFontSize: (size) => set({ readerFontSize: size }),
      setReaderLineHeight: (height) => set({ readerLineHeight: height }),
    }),
    {
      name: "reader-preferences", // Uses a unified key in localStorage
      partialize: (state) => ({
        highlightSaveMode: state.highlightSaveMode,
        readerFontSize: state.readerFontSize,
        readerLineHeight: state.readerLineHeight,
      }),
    }
  )
);
