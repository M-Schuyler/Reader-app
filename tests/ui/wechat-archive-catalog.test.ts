import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readWorkspaceFile(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("wechat archive catalog has a runnable metadata-only import script and schema state", () => {
  const schema = readWorkspaceFile("prisma/schema.prisma");
  const script = readWorkspaceFile("scripts/import/wechat-archive-catalog.ts");
  const packageJson = readWorkspaceFile("package.json");

  assert.match(schema, /enum IngestionStatus[\s\S]*CATALOG/);
  assert.match(schema, /archivePath\s+String\?/);
  assert.match(script, /importWechatArchiveCatalog/);
  assert.match(script, /projects[\\/]信息源[\\/]公众号/);
  assert.match(packageJson, /import:wechat-archive-catalog/);
});

test("archive page reuses the locked Sources page structure and requests only catalog documents", () => {
  const page = readWorkspaceFile("src/app/(main)/sources/archive/page.tsx");

  assert.match(page, /<section className="space-y-8">/);
  assert.match(page, /eyebrow="备份库"/);
  assert.match(page, /title="公众号存档"/);
  assert.match(page, /<Panel[\s\S]*tone="muted"/);
  assert.match(page, /IngestionStatus\.CATALOG/);
  assert.match(page, /WechatArchiveCatalog/);
  assert.match(page, /还没扫描存档/);
});

test("catalog UI reuses DocumentList and provides single plus selected imports", () => {
  const catalog = readWorkspaceFile("src/components/library/wechat-archive-catalog.tsx");
  const list = readWorkspaceFile("src/components/library/document-list.tsx");
  const menu = readWorkspaceFile("src/components/library/source-library-more-menu.tsx");

  assert.match(catalog, /DocumentList/);
  assert.match(catalog, /导入选中/);
  assert.match(catalog, /selectedIds/);
  assert.match(catalog, /for \(const id of selectedIds\)/);
  assert.match(list, /IngestionStatus\.CATALOG/);
  assert.match(list, /type="checkbox"/);
  assert.match(list, /import-from-archive/);
  assert.match(list, /未导入/);
  assert.match(list, /isCatalog \? \(\s*<div className="block space-y-3\.5">/);
  assert.match(
    list,
    /inline-flex min-h-10 items-center rounded-\[18px\] border border-\[color:var\(--border-subtle\)\] px-4 text-sm font-medium text-\[color:var\(--text-primary\)\] transition hover:border-\[color:var\(--border-strong\)\]/,
  );
  assert.match(menu, /公众号存档/);
  assert.match(menu, /\/sources\/archive/);
});
