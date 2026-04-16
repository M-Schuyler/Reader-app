import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readWorkspaceFile(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("reader rich content supports table and inline semantic tags", () => {
  const richContent = readWorkspaceFile("src/components/reader/reader-rich-content.tsx");
  const globals = readWorkspaceFile("src/app/globals.css");

  assert.match(richContent, /case "table":/);
  assert.match(richContent, /reader-table-wrap/);
  assert.match(richContent, /case "thead":/);
  assert.match(richContent, /case "tbody":/);
  assert.match(richContent, /case "tr":/);
  assert.match(richContent, /case "th":/);
  assert.match(richContent, /case "td":/);
  assert.match(richContent, /case "caption":/);
  assert.match(richContent, /case "sup":/);
  assert.match(richContent, /case "sub":/);
  assert.match(richContent, /case "u":/);
  assert.match(richContent, /case "del":/);

  assert.match(globals, /\.reader-table-wrap/);
  assert.match(globals, /\.reader-table/);
  assert.match(globals, /\.reader-table thead th/);
  assert.match(globals, /font-size:\s*var\(--reader-font-size,\s*1.125rem\)/);
  assert.match(globals, /line-height:\s*var\(--reader-line-height,\s*2\)/);
});
