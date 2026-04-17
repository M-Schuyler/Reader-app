import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

test("header account menu closes when clicking outside the panel", () => {
  const menu = readFileSync(path.join(root, "src/components/layout/header-account-menu.tsx"), "utf8");

  assert.match(menu, /useEffect,\s*useRef/);
  assert.match(menu, /ref=\{detailsRef\}/);
  assert.match(menu, /document\.addEventListener\("pointerdown", handlePointerDown\)/);
  assert.match(menu, /details\.contains\(target\)/);
  assert.match(menu, /details\.open = false/);
});
