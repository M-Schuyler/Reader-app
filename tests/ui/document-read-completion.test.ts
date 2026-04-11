import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

test("document read-state route requires auth and only supports PATCH", () => {
  const route = readFileSync(path.join(root, "src/app/api/documents/[id]/read-state/route.ts"), "utf8");

  assert.match(route, /requireApiUser/);
  assert.match(route, /export async function PATCH/);
  assert.match(route, /parseUpdateDocumentReadStateInput/);
  assert.match(route, /DOCUMENT_NOT_FOUND/);
  assert.doesNotMatch(route, /export async function GET/);
});

test("document reader renders an inline completion footer instead of toast-style feedback", () => {
  const reader = readFileSync(path.join(root, "src/components/reader/document-reader.tsx"), "utf8");
  const hook = readFileSync(path.join(root, "src/components/reader/use-document-read-completion.ts"), "utf8");
  const globals = readFileSync(path.join(root, "src/app/globals.css"), "utf8");

  assert.match(reader, /useDocumentReadCompletion/);
  assert.match(reader, /已读完/);
  assert.match(reader, /已收入已读归档/);
  assert.match(reader, /pointer-events-none/);
  assert.match(reader, /data-read-completion/);
  assert.match(reader, /继续下拉，完成阅读/);
  assert.match(hook, /\/api\/documents\/\$\{documentId\}\/read-state/);
  assert.match(hook, /1200/);
  assert.match(hook, /COMPLETION_REFRESH_DELAY_MS/);
  assert.match(globals, /reader-read-completion-line/);
  assert.match(globals, /reader-read-completion-label/);
  assert.match(globals, /reader-read-completion-subtitle/);
  assert.match(globals, /reader-read-completion-glow/);
  assert.match(globals, /reader-read-completion-shell/);
  assert.match(globals, /reader-read-completion-shell-out/);
  assert.match(globals, /reader-read-completion-line-out/);
  assert.doesNotMatch(reader, /toast/i);
  assert.doesNotMatch(reader, /modal/i);
});
