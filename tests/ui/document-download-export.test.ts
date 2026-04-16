import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

test("reader panel exposes markdown, obsidian, and html download actions", () => {
  const panel = readFileSync(path.join(root, "src/components/reader/reader-floating-panel.tsx"), "utf8");

  assert.doesNotMatch(panel, /实时预览/);
  assert.match(panel, /下载 Markdown/);
  assert.match(panel, /下载 Obsidian/);
  assert.match(panel, /下载 HTML/);
  assert.match(panel, /\/api\/documents\/\$\{readerDocument\.id\}\/download\?format=markdown/);
  assert.match(panel, /\/api\/documents\/\$\{readerDocument\.id\}\/download\?format=obsidian/);
  assert.match(panel, /\/api\/documents\/\$\{readerDocument\.id\}\/download\?format=html/);
});

test("document download route requires auth and supports attachment responses", () => {
  const route = readFileSync(path.join(root, "src/app/api/documents/[id]/download/route.ts"), "utf8");

  assert.match(route, /requireApiUser/);
  assert.match(route, /export async function GET/);
  assert.match(route, /Content-Disposition/);
  assert.match(route, /DOCUMENT_NOT_FOUND/);
  assert.match(route, /parseDocumentDownloadFormat/);
});
