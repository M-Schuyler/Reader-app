import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

test("document reader exposes markdown and html download actions", () => {
  const reader = readFileSync(path.join(root, "src/components/reader/document-reader.tsx"), "utf8");

  assert.match(reader, /下载 Markdown/);
  assert.match(reader, /下载 HTML/);
  assert.match(reader, /\/api\/documents\/\$\{readerDocument\.id\}\/download\?format=markdown/);
  assert.match(reader, /\/api\/documents\/\$\{readerDocument\.id\}\/download\?format=html/);
});

test("document download route requires auth and supports attachment responses", () => {
  const route = readFileSync(path.join(root, "src/app/api/documents/[id]/download/route.ts"), "utf8");

  assert.match(route, /requireApiUser/);
  assert.match(route, /export async function GET/);
  assert.match(route, /Content-Disposition/);
  assert.match(route, /DOCUMENT_NOT_FOUND/);
  assert.match(route, /parseDocumentDownloadFormat/);
});
