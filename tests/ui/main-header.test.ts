import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readWorkspaceFile(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("main layout delegates shell rendering to workspace chrome", () => {
  const layout = readWorkspaceFile("src/app/(main)/layout.tsx");
  const chrome = readWorkspaceFile("src/components/layout/main-workspace-chrome.tsx");
  const rail = readWorkspaceFile("src/components/layout/navigation-rail.tsx");
  const bottomNav = readWorkspaceFile("src/components/layout/mobile-bottom-nav.tsx");
  const headerShell = readWorkspaceFile("src/components/layout/main-header-shell.tsx");
  const accountMenu = readWorkspaceFile("src/components/layout/header-account-menu.tsx");

  assert.match(layout, /MainWorkspaceChrome/);
  assert.doesNotMatch(layout, /<MainNav/);
  assert.doesNotMatch(layout, /<GlobalSearch/);

  assert.match(chrome, /<NavigationRail/);
  assert.match(chrome, /<MobileBottomNav/);
  assert.match(chrome, /<GlobalSearch onOpenChange=\{setSearchOpen\} open=\{searchOpen\} \/>/);
  assert.match(chrome, /reader-panel-toggle-slot/);

  assert.match(rail, /HeaderAccountMenu/);
  assert.match(rail, /data-rail-visual-state/);
  assert.match(rail, /transition-opacity ease-out/);
  assert.match(rail, /border-r border-\[color:var\(--border-subtle\)\]/);
  assert.match(rail, /opacity: railOpacity/);
  assert.doesNotMatch(rail, /translateX|translate-x/);

  assert.match(bottomNav, /SearchNavIcon/);
  assert.match(bottomNav, /id === "reading"/);
  assert.match(bottomNav, /whitespace-nowrap/);

  assert.match(headerShell, /sticky top-0 z-30/);
  assert.doesNotMatch(headerShell, /translate|SCROLL_HIDE_THRESHOLD|SCROLL_JITTER_THRESHOLD/);
  assert.match(accountMenu, /ThemeToggle/);
  assert.match(accountMenu, /个性化/);
  assert.match(accountMenu, /设置/);
  assert.match(accountMenu, /href="\/export"/);
  assert.match(accountMenu, /退出登录/);
  assert.match(accountMenu, /<details/);
  assert.match(accountMenu, /onOpenChange\?: \(open: boolean\) => void/);
  assert.match(accountMenu, /h-8 w-8/);
  assert.match(accountMenu, /bg-stone-800 text-\[13px\] font-semibold text-white/);
});

test("theme toggle no longer renders an extra appearance label", () => {
  const toggle = readWorkspaceFile("src/components/theme/theme-toggle.tsx");

  assert.doesNotMatch(toggle, /外观/);
  assert.match(toggle, /rounded-full border/);
  assert.match(toggle, /className,?[\s\S]*ThemeToggleProps/);
});
