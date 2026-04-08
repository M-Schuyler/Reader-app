import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readWorkspaceFile(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("sources page renders the summary queue pill in the header action row", () => {
  const page = readWorkspaceFile("src/app/(main)/sources/page.tsx");
  const pill = readWorkspaceFile("src/components/library/summary-queue-pill.tsx");
  const helper = readWorkspaceFile("src/lib/documents/summary-queue-pill.ts");

  assert.match(page, /SummaryQueuePill/);
  assert.match(page, /summaryQueueStatus/);
  assert.match(page, /getSummaryQueueStatusForReader/);

  assert.match(pill, /summary-jobs\/status/);
  assert.match(pill, /summary-jobs\/sweep/);
  assert.match(helper, /摘要队列/);
  assert.match(helper, /处理中…/);
  assert.match(helper, /稍后再试/);
  assert.match(helper, /摘要已是最新/);
});
