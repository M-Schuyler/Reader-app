import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readWorkspaceFile(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("cubox import exposes a dedicated page, route, and account-menu entry point", () => {
  const page = readWorkspaceFile("src/app/(main)/sources/import/cubox/page.tsx");
  const route = readWorkspaceFile("src/app/api/imports/cubox/route.ts");
  const accountMenu = readWorkspaceFile("src/components/layout/header-account-menu.tsx");

  assert.match(page, /导入 Cubox/);
  assert.match(page, /CuboxImportForm/);
  assert.match(route, /export async function POST/);
  assert.match(route, /requireApiUser/);
  assert.match(route, /importCuboxBatch/);
  assert.match(accountMenu, /导入 Cubox/);
  assert.match(accountMenu, /\/sources\/import\/cubox/);
  assert.match(accountMenu, /\/sources\/import\/cubox[\s\S]*\/export/);
});

test("cubox import schema stores external ids for web documents and highlights", () => {
  const schema = readWorkspaceFile("prisma/schema.prisma");

  assert.match(schema, /@@index\(\[type, externalId\]\)/);
  assert.match(schema, /model Highlight[\s\S]*externalId\s+String\?/);
  assert.match(schema, /@@unique\(\[documentId, externalId\]\)/);
});
