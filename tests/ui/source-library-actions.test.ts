import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readWorkspaceFile(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("source detail exposes rename controls and document deletion actions", () => {
  const detail = readWorkspaceFile("src/components/library/source-library-detail.tsx");
  const list = readWorkspaceFile("src/components/library/source-library-document-list.tsx");
  const documentRoute = readWorkspaceFile("src/app/api/documents/[id]/route.ts");

  assert.match(detail, /SourceAliasEditor/);
  assert.match(detail, /重命名书架|自定义命名/);
  assert.match(list, /删除/);
  assert.match(list, /window\.confirm/);
  assert.match(list, /method:\s*"DELETE"/);
  assert.match(documentRoute, /export async function DELETE/);
  assert.match(documentRoute, /deleteDocument/);
});

test("source alias route exists as a dedicated source-level persistence endpoint", () => {
  const route = readWorkspaceFile("src/app/api/sources/alias/route.ts");
  const service = readWorkspaceFile("src/server/modules/documents/document.service.ts");
  const schema = readWorkspaceFile("prisma/schema.prisma");

  assert.match(route, /requireApiUser/);
  assert.match(route, /export async function PUT/);
  assert.match(route, /updateSourceAliasName/);
  assert.match(service, /parseUpdateSourceAliasInput/);
  assert.match(service, /updateSourceAliasName/);
  assert.match(schema, /model SourceAlias/);
});
