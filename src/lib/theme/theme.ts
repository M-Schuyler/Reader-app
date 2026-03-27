export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_ATTRIBUTE = "data-theme";
export const THEME_PREFERENCE_ATTRIBUTE = "data-theme-preference";
export const THEME_PREFERENCE_STORAGE_KEY = "reader-theme-preference";
export const SYSTEM_THEME_MEDIA_QUERY = "(prefers-color-scheme: dark)";

export function normalizeThemePreference(value: string | null | undefined): ThemePreference {
  if (value === "light" || value === "dark" || value === "system") {
    return value;
  }

  return "system";
}

export function resolveTheme(preference: ThemePreference, systemTheme: ResolvedTheme): ResolvedTheme {
  return preference === "system" ? systemTheme : preference;
}

export function resolveSystemTheme(matchesDark: boolean): ResolvedTheme {
  return matchesDark ? "dark" : "light";
}

export function applyThemeToDocument(root: HTMLElement, preference: ThemePreference, resolvedTheme: ResolvedTheme) {
  root.setAttribute(THEME_ATTRIBUTE, resolvedTheme);
  root.setAttribute(THEME_PREFERENCE_ATTRIBUTE, preference);
  root.style.colorScheme = resolvedTheme;
}

export function getThemeInitializationScript() {
  return `
    (() => {
      const THEME_ATTRIBUTE = "${THEME_ATTRIBUTE}";
      const THEME_PREFERENCE_ATTRIBUTE = "${THEME_PREFERENCE_ATTRIBUTE}";
      const THEME_PREFERENCE_STORAGE_KEY = "${THEME_PREFERENCE_STORAGE_KEY}";
      const SYSTEM_THEME_MEDIA_QUERY = "${SYSTEM_THEME_MEDIA_QUERY}";

      const normalizeThemePreference = (value) => {
        return value === "light" || value === "dark" || value === "system" ? value : "system";
      };

      const resolveTheme = (preference, systemTheme) => {
        return preference === "system" ? systemTheme : preference;
      };

      const resolveSystemTheme = (matchesDark) => {
        return matchesDark ? "dark" : "light";
      };

      const root = document.documentElement;
      let storedPreference = "system";

      try {
        storedPreference = normalizeThemePreference(window.localStorage.getItem(THEME_PREFERENCE_STORAGE_KEY));
      } catch {
        storedPreference = "system";
      }

      const systemTheme = resolveSystemTheme(window.matchMedia(SYSTEM_THEME_MEDIA_QUERY).matches);
      const resolvedTheme = resolveTheme(storedPreference, systemTheme);
      root.setAttribute(THEME_ATTRIBUTE, resolvedTheme);
      root.setAttribute(THEME_PREFERENCE_ATTRIBUTE, storedPreference);
      root.style.colorScheme = resolvedTheme;
    })();
  `;
}
