import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

function readWorkspaceFile(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

test("AI summary surfaces share one MagicWandIcon implementation", () => {
  const files = [
    "src/app/(main)/export/page.tsx",
    "src/components/export/export-candidate-batch-actions.tsx",
    "src/components/library/document-list.tsx",
    "src/components/reader/document-reader.tsx",
    "src/components/search/global-search.tsx",
  ];

  for (const file of files) {
    const content = readWorkspaceFile(file);
    assert.match(content, /@\/components\/icons\/magic-wand-icon/);
    assert.doesNotMatch(content, /function MagicWandIcon/);
    assert.doesNotMatch(content, /function SparklesIcon/);
  }
});

test("shared magic wand icon keeps a small-size readable geometry", () => {
  const icon = readWorkspaceFile("src/components/icons/magic-wand-icon.tsx");

  assert.match(icon, /className=\{cx\("h-4 w-4", className\)\}/);
  assert.match(icon, /viewBox="0 0 24 24"/);
  assert.match(icon, /M12 3c0 4\.5-2 6\.5-6\.5 6\.5/);
  assert.match(icon, /M5 16c0 2\.5-1 3\.5/);
});
