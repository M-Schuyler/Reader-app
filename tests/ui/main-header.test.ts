import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readWorkspaceFile(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("main header keeps the brand quiet and gives search its own space", () => {
  const layout = readWorkspaceFile("src/app/(main)/layout.tsx");
  const headerShell = readWorkspaceFile("src/components/layout/main-header-shell.tsx");
  const nav = readWorkspaceFile("src/components/layout/main-nav.tsx");
  const accountMenu = readWorkspaceFile("src/components/layout/header-account-menu.tsx");

  assert.match(layout, /HeaderAccountMenu/);
  assert.doesNotMatch(layout, /ThemeToggle/);
  assert.doesNotMatch(layout, /\{user\.email\}/);
  assert.doesNotMatch(layout, /退出登录/);
  assert.match(layout, /lg:grid-cols-\[auto_minmax\(0,1fr\)_auto\]/);
  assert.match(layout, /text-\[1\.95rem\]/);
  assert.match(layout, /flex items-center gap-2/);
  assert.match(layout, /reader-panel-toggle-slot/);
  assert.match(layout, /MainHeaderShell/);
  assert.match(headerShell, /window\.addEventListener\("scroll", handleScroll, \{ passive: true \}\)/);
  assert.match(headerShell, /SCROLL_HIDE_THRESHOLD = 20/);
  assert.match(headerShell, /SCROLL_JITTER_THRESHOLD = 8/);
  assert.match(headerShell, /pathname\.startsWith\("\/documents\/"\)/);
  assert.match(headerShell, /transition-transform duration-300 ease-in-out/);
  assert.match(headerShell, /-translate-y-full/);
  assert.match(headerShell, /panelToggleSlot\?\.getAttribute\("data-panel-open"\) === "true"/);
  assert.match(nav, /overflow-x-auto/);
  assert.match(nav, /whitespace-nowrap/);
  assert.match(nav, /inline-flex items-center gap-1 whitespace-nowrap/);
  assert.match(nav, /after:bg-stone-900/);
  assert.match(accountMenu, /ThemeToggle/);
  assert.match(accountMenu, /退出登录/);
  assert.match(accountMenu, /<details/);
  assert.match(accountMenu, /h-8 w-8/);
  assert.match(accountMenu, /bg-stone-800 text-\[13px\] font-semibold text-white/);
});

test("theme toggle no longer renders an extra appearance label", () => {
  const toggle = readWorkspaceFile("src/components/theme/theme-toggle.tsx");

  assert.doesNotMatch(toggle, /外观/);
  assert.match(toggle, /rounded-full border/);
  assert.match(toggle, /className,?[\s\S]*ThemeToggleProps/);
});
