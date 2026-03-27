import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

function readWorkspaceFile(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("app shell typography prefers PingFang for UI while keeping reader prose serif", () => {
  const globalsCss = readWorkspaceFile("src/app/globals.css");

  assert.match(globalsCss, /--font-sans:\s*"PingFang SC"/);
  assert.match(globalsCss, /\.reader-prose\s*\{[\s\S]*font-family:\s*var\(--font-display\);/);
});

test("root layout exposes the Chinese locale and key UI components use stronger system-style weight", () => {
  const layout = readWorkspaceFile("src/app/layout.tsx");
  const pageHeader = readWorkspaceFile("src/components/ui/page-header.tsx");
  const mainNav = readWorkspaceFile("src/components/layout/main-nav.tsx");
  const button = readWorkspaceFile("src/components/ui/button.tsx");

  assert.match(layout, /lang="zh-CN"/);
  assert.match(pageHeader, /className="font-ui-heading text-4xl/);
  assert.doesNotMatch(pageHeader, /className="font-display text-4xl/);
  assert.match(mainNav, /className=\{cx\([\s\S]*font-semibold/);
  assert.match(button, /className=\{cx\([\s\S]*font-semibold transition/);
});
