import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();

test("export page renders the batch actions component for candidate queue", () => {
  const exportPage = readFileSync(path.join(root, "src/app/(main)/export/page.tsx"), "utf8");

  assert.match(exportPage, /ExportCandidateBatchActions/);
  assert.match(exportPage, /<ExportCandidateBatchActions candidates=\{overview\.candidates\} \/>/);
});

test("batch export candidate component includes selection controls and batch download request", () => {
  const component = readFileSync(path.join(root, "src/components/export/export-candidate-batch-actions.tsx"), "utf8");

  assert.match(component, /Selected/);
  assert.match(component, />All</);
  assert.match(component, />None</);
  assert.match(component, /type="checkbox"/);
  assert.match(component, /Export/);
  assert.match(component, /\/api\/export\/batch-download/);
  assert.match(component, /documentIds: selectedDocumentIds/);
  assert.match(component, /format,/);
});

test("batch export API route enforces auth and returns zip attachments", () => {
  const route = readFileSync(path.join(root, "src/app/api/export/batch-download/route.ts"), "utf8");

  assert.match(route, /export async function POST/);
  assert.match(route, /requireApiUser/);
  assert.match(route, /readJsonBodyOrThrow/);
  assert.match(route, /parseBatchDocumentDownloadInput/);
  assert.match(route, /buildBatchDocumentDownloadArchive/);
  assert.match(route, /"Content-Type": "application\/zip"/);
  assert.match(route, /Content-Disposition/);
});
