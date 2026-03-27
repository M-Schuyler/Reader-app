import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  THEME_ATTRIBUTE,
  THEME_PREFERENCE_STORAGE_KEY,
  normalizeThemePreference,
  resolveTheme,
} from "@/lib/theme/theme";

function readWorkspaceFile(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("theme preference normalizes invalid values and resolves against system state", () => {
  assert.equal(THEME_ATTRIBUTE, "data-theme");
  assert.equal(THEME_PREFERENCE_STORAGE_KEY, "reader-theme-preference");

  assert.equal(normalizeThemePreference("light"), "light");
  assert.equal(normalizeThemePreference("dark"), "dark");
  assert.equal(normalizeThemePreference("system"), "system");
  assert.equal(normalizeThemePreference("sepia"), "system");
  assert.equal(normalizeThemePreference(null), "system");

  assert.equal(resolveTheme("light", "dark"), "light");
  assert.equal(resolveTheme("dark", "light"), "dark");
  assert.equal(resolveTheme("system", "dark"), "dark");
  assert.equal(resolveTheme("system", "light"), "light");
});

test("theme system is wired into the app shell and global tokens", () => {
  const rootLayout = readWorkspaceFile("src/app/layout.tsx");
  const mainLayout = readWorkspaceFile("src/app/(main)/layout.tsx");
  const globalsCss = readWorkspaceFile("src/app/globals.css");

  assert.match(rootLayout, /ThemeScript/);
  assert.match(rootLayout, /data-theme="light"/);
  assert.match(rootLayout, /suppressHydrationWarning/);
  assert.match(mainLayout, /ThemeToggle/);
  assert.match(globalsCss, /:root\[data-theme="dark"\]/);
  assert.match(globalsCss, /--bg-header:/);
  assert.match(globalsCss, /--bg-field:/);
  assert.match(globalsCss, /--button-primary-bg:/);
  assert.match(globalsCss, /--highlight-mark-bg:/);
});
