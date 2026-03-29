import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readWorkspaceFile(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("main header keeps the brand quiet and gives search its own space", () => {
  const layout = readWorkspaceFile("src/app/(main)/layout.tsx");

  assert.doesNotMatch(layout, /输入先进来源库，开始阅读后再进入 Reading/);
  assert.match(layout, /text-\[1\.7rem\]/);
  assert.match(layout, /lg:grid-cols-\[auto_minmax\(15rem,24rem\)_auto\]/);
  assert.doesNotMatch(layout, /<p className="mt-1 text-\[15px\]/);
});

test("theme toggle no longer renders an extra appearance label", () => {
  const toggle = readWorkspaceFile("src/components/theme/theme-toggle.tsx");

  assert.doesNotMatch(toggle, /外观/);
  assert.match(toggle, /rounded-full border/);
});
