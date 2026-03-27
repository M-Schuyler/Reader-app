"use client";

import { useEffect, useState } from "react";
import {
  applyThemeToDocument,
  normalizeThemePreference,
  resolveSystemTheme,
  resolveTheme,
  SYSTEM_THEME_MEDIA_QUERY,
  THEME_PREFERENCE_ATTRIBUTE,
  THEME_PREFERENCE_STORAGE_KEY,
  type ThemePreference,
} from "@/lib/theme/theme";
import { cx } from "@/utils/cx";

const themeOptions: Array<{ label: string; value: ThemePreference }> = [
  { label: "浅色", value: "light" },
  { label: "深色", value: "dark" },
  { label: "系统", value: "system" },
];

export function ThemeToggle() {
  const [preference, setPreference] = useState<ThemePreference>("system");

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const root = document.documentElement;
    const mediaQuery = window.matchMedia(SYSTEM_THEME_MEDIA_QUERY);
    const initialPreference = normalizeThemePreference(
      root.getAttribute(THEME_PREFERENCE_ATTRIBUTE) ?? window.localStorage.getItem(THEME_PREFERENCE_STORAGE_KEY),
    );

    applyThemePreference(initialPreference, mediaQuery);
    setPreference(initialPreference);

    const handleSystemThemeChange = (event: MediaQueryListEvent) => {
      const currentPreference = normalizeThemePreference(root.getAttribute(THEME_PREFERENCE_ATTRIBUTE));

      if (currentPreference !== "system") {
        return;
      }

      applyThemeToDocument(root, currentPreference, resolveSystemTheme(event.matches));
    };

    mediaQuery.addEventListener("change", handleSystemThemeChange);

    return () => {
      mediaQuery.removeEventListener("change", handleSystemThemeChange);
    };
  }, []);

  function applyThemePreference(nextPreference: ThemePreference, mediaQuery?: MediaQueryList) {
    if (typeof window === "undefined") {
      return;
    }

    const activeMediaQuery = mediaQuery ?? window.matchMedia(SYSTEM_THEME_MEDIA_QUERY);
    const resolvedTheme = resolveTheme(nextPreference, resolveSystemTheme(activeMediaQuery.matches));
    applyThemeToDocument(document.documentElement, nextPreference, resolvedTheme);
    window.localStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, nextPreference);
  }

  function handleThemeChange(nextPreference: ThemePreference) {
    applyThemePreference(nextPreference);
    setPreference(nextPreference);
  }

  return (
    <div className="flex items-center gap-2.5">
      <span className="hidden text-[11px] font-medium uppercase tracking-[0.24em] text-[color:var(--text-tertiary)] lg:inline">
        外观
      </span>
      <div className="inline-flex items-center rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface-soft)] p-1">
        {themeOptions.map((option) => (
          <button
            aria-label={option.value === "system" ? "跟随系统" : option.label}
            className={cx(
              "min-h-8 rounded-full px-3 text-xs font-semibold transition",
              preference === option.value
                ? "bg-[color:var(--bg-surface-strong)] text-[color:var(--text-primary)] shadow-[var(--shadow-surface-muted)]"
                : "text-[color:var(--text-secondary)] hover:bg-[color:var(--button-quiet-hover-bg)] hover:text-[color:var(--text-primary)]",
            )}
            key={option.value}
            onClick={() => handleThemeChange(option.value)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
