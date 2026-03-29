import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readWorkspaceFile(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("main header keeps the brand quiet and gives search its own space", () => {
  const layout = readWorkspaceFile("src/app/(main)/layout.tsx");
  const nav = readWorkspaceFile("src/components/layout/main-nav.tsx");
  const accountMenu = readWorkspaceFile("src/components/layout/header-account-menu.tsx");

  assert.match(layout, /HeaderAccountMenu/);
  assert.doesNotMatch(layout, /ThemeToggle/);
  assert.doesNotMatch(layout, /\{user\.email\}/);
  assert.doesNotMatch(layout, /退出登录/);
  assert.match(layout, /lg:grid-cols-\[auto_minmax\(0,1fr\)_auto\]/);
  assert.match(layout, /text-\[1\.95rem\]/);
  assert.match(nav, /overflow-x-auto/);
  assert.match(nav, /whitespace-nowrap/);
  assert.match(nav, /inline-flex items-center rounded-full border/);
  assert.match(accountMenu, /ThemeToggle/);
  assert.match(accountMenu, /退出登录/);
  assert.match(accountMenu, /<details/);
});

test("theme toggle no longer renders an extra appearance label", () => {
  const toggle = readWorkspaceFile("src/components/theme/theme-toggle.tsx");

  assert.doesNotMatch(toggle, /外观/);
  assert.match(toggle, /rounded-full border/);
  assert.match(toggle, /className,?[\s\S]*ThemeToggleProps/);
});
