import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readWorkspaceFile(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("highlights page renders the full paginated archive instead of a hard-coded recent slice", () => {
  const page = readWorkspaceFile("src/app/(main)/highlights/page.tsx");
  const service = readWorkspaceFile("src/server/modules/highlights/highlight-overview.service.ts");

  assert.match(page, /overview\.highlights\.map/);
  assert.match(page, /上一页/);
  assert.match(page, /下一页/);
  assert.match(page, /page=/);
  assert.doesNotMatch(page, /overview\.recentHighlights\.map/);

  assert.match(service, /buildHighlightOverviewPagination/);
  assert.match(service, /skip:/);
  assert.doesNotMatch(service, /take:\s*8/);
});
