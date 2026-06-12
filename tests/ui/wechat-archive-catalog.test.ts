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

test("catalog UI is a compact hover-expanding list with single and batch imports", () => {
  const catalog = readWorkspaceFile("src/components/library/wechat-archive-catalog.tsx");
  const menu = readWorkspaceFile("src/components/library/source-library-more-menu.tsx");

  // 目录式:默认紧凑单行(truncate),悬停才展开摘要详情(group-hover)
  assert.match(catalog, /truncate/);
  assert.match(catalog, /group-hover:grid-rows-\[1fr\]/);
  assert.match(catalog, /item\.excerpt/);
  // 单篇 + 批量导入
  assert.match(catalog, /import-from-archive/);
  assert.match(catalog, /onImport/);
  assert.match(catalog, /导入选中/);
  assert.match(catalog, /selectedIds/);
  // checkbox 选择
  assert.match(catalog, /type="checkbox"/);
  // 入口仍在 Sources 的更多菜单
  assert.match(menu, /公众号存档/);
  assert.match(menu, /\/sources\/archive/);
});
