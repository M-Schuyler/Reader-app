import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readWorkspaceFile(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("sources page uses the overflow menu for cubox import and manual summary sweep", () => {
  const page = readWorkspaceFile("src/app/(main)/sources/page.tsx");
  const menu = readWorkspaceFile("src/components/library/source-library-more-menu.tsx");

  assert.match(page, /SourceLibraryMoreMenu/);
  assert.doesNotMatch(page, /SummaryQueuePill/);
  assert.doesNotMatch(page, /getSummaryQueueStatusForReader/);

  assert.match(menu, /导入 Cubox/);
  assert.match(menu, /补跑摘要/);
  assert.match(menu, /summary-jobs\/sweep/);
  assert.match(menu, /运行中…/);
  assert.match(menu, /完成/);
});
