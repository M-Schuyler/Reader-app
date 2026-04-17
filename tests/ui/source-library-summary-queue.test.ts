import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readWorkspaceFile(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("sources page uses the overflow menu for capture actions and manual ai queue sweep", () => {
  const page = readWorkspaceFile("src/app/(main)/sources/page.tsx");
  const menu = readWorkspaceFile("src/components/library/source-library-more-menu.tsx");

  assert.match(page, /SourceLibraryMoreMenu/);
  assert.doesNotMatch(page, /SourceLibraryToolbar/);
  assert.doesNotMatch(page, /SummaryQueuePill/);
  assert.doesNotMatch(page, /getSummaryQueueStatusForReader/);

  assert.doesNotMatch(menu, /导入 Cubox/);
  assert.match(menu, /CaptureUrlForm/);
  assert.match(menu, /CreateSourceForm/);
  assert.match(menu, /保存网页链接/);
  assert.match(menu, /添加 RSS 来源/);
  assert.match(menu, /补跑 AI 队列/);
  assert.match(menu, /保存网页链接[\s\S]*添加 RSS 来源[\s\S]*补跑 AI 队列/);
  assert.match(menu, /min-w-\[280px\]/);
  assert.match(menu, /props\.expanded \? "∨" : "›"/);
  assert.match(menu, /fixed inset-0 z-40 bg-black\/20/);
  assert.match(menu, /summary-jobs\/sweep/);
  assert.match(menu, /运行中…/);
  assert.match(menu, /完成/);
});
