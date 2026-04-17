import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readWorkspaceFile(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("transcript queue wiring includes cron support, internal get handler, and safe job claiming", () => {
  const vercelConfig = readWorkspaceFile("vercel.json");
  const route = readWorkspaceFile("src/app/api/internal/transcript-jobs/sweep/route.ts");
  const service = readWorkspaceFile("src/server/modules/documents/document-transcript-jobs.service.ts");

  assert.match(vercelConfig, /"path": "\/api\/internal\/transcript-jobs\/sweep"/);
  assert.match(route, /export async function GET/);
  assert.match(route, /requireInternalApiAccess/);
  assert.match(service, /updateMany\(\{/);
  assert.match(service, /status: IngestionJobStatus\.PENDING/);
});
