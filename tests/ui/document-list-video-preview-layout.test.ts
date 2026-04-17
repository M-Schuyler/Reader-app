import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readWorkspaceFile(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("video preview stays in the action column instead of overlapping favorite controls", () => {
  const list = readWorkspaceFile("src/components/library/document-list.tsx");

  assert.match(list, /item\.videoThumbnailUrl && \(/);
  assert.match(list, /sm:flex-col sm:items-end sm:gap-2/);
  assert.match(list, /className="hidden xl:block pointer-events-none"/);
  assert.match(list, /className="relative z-10 opacity-20 transition-opacity group-hover:opacity-100"/);
  assert.doesNotMatch(list, /absolute right-20 top-8 hidden xl:block pointer-events-none/);
});
