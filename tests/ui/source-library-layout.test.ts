import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readWorkspaceFile(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("sources page uses the dedicated source index view with a compact overflow action menu", () => {
  const sourcesPage = readWorkspaceFile("src/app/(main)/sources/page.tsx");
  const readingPage = readWorkspaceFile("src/app/(main)/reading/page.tsx");
  const highlightsPage = readWorkspaceFile("src/app/(main)/highlights/page.tsx");
  const exportPage = readWorkspaceFile("src/app/(main)/export/page.tsx");
  const sourceAllPage = readWorkspaceFile("src/app/(main)/sources/all/page.tsx");
  const cuboxImportPage = readWorkspaceFile("src/app/(main)/sources/import/cubox/page.tsx");
  const namedSourcePage = readWorkspaceFile("src/app/(main)/sources/[sourceId]/page.tsx");
  const sourceDetailPage = readWorkspaceFile("src/app/(main)/sources/source-detail-page.tsx");
  const menu = readWorkspaceFile("src/components/library/source-library-more-menu.tsx");

  assert.match(sourcesPage, /SourceLibraryIndex/);
  assert.match(sourcesPage, /SourceLibraryMoreMenu/);
  assert.match(sourcesPage, /getSourceLibraryIndex/);
  assert.doesNotMatch(sourcesPage, /<PageHeader/);
  assert.match(sourcesPage, /font-ui-heading text-2xl font-bold/);
  assert.match(menu, /CaptureUrlForm/);
  assert.match(menu, /CreateSourceForm/);
  assert.doesNotMatch(menu, /导入 Cubox/);
  assert.match(menu, /保存网页链接/);
  assert.match(menu, /添加 RSS 来源/);
  assert.match(menu, /补跑 AI 队列/);
  assert.match(menu, /保存网页链接[\s\S]*添加 RSS 来源[\s\S]*补跑 AI 队列/);
  assert.match(menu, /min-w-\[280px\]/);
  assert.match(menu, /props\.expanded \? "∨" : "›"/);
  assert.doesNotMatch(readingPage, /description=/);
  assert.doesNotMatch(highlightsPage, /description=/);
  assert.doesNotMatch(exportPage, /description=/);
  assert.doesNotMatch(sourceAllPage, /description=/);
  assert.doesNotMatch(cuboxImportPage, /description=/);
  assert.doesNotMatch(namedSourcePage, /description=/);
  assert.doesNotMatch(sourceDetailPage, /description=/);
});

test("source library index renders a single recent-7-days section and keeps dedicated empty states", () => {
  const sourceLibrary = readWorkspaceFile("src/components/library/source-library.tsx");
  const sourceCard = readWorkspaceFile("src/components/library/source-library-source-card.tsx");

  assert.match(sourceLibrary, /SourceLibraryIndex/);
  assert.match(sourceLibrary, /allDocumentsHref/);
  assert.match(sourceLibrary, /显示全部文档/);
  assert.match(sourceLibrary, /最近 7 天/);
  assert.match(sourceLibrary, /最近 7 天没有新来源/);
  assert.match(sourceLibrary, /来源库还没有内容/);
  assert.match(sourceLibrary, /SourceLibraryIndexCard/);
  assert.match(sourceLibrary, /href=\{group\.href/);
  assert.match(sourceLibrary, /getSourceLibraryToneForSeed\(group\.id\)/);
  assert.match(sourceLibrary, /className="flex flex-wrap items-center gap-4"/);
  assert.doesNotMatch(sourceLibrary, /SOURCE_SHELF_META/);
  assert.doesNotMatch(sourceLibrary, /最近收进来/);
  assert.doesNotMatch(sourceLibrary, /近七天/);
  assert.doesNotMatch(sourceLibrary, /label:\s*"更早"/);
  assert.match(sourceCard, /h-\[18rem\]/);
});

test("source library toolbar supports an index-only mode with just the two capture forms", () => {
  const toolbar = readWorkspaceFile("src/components/library/source-library-toolbar.tsx");
  const captureForm = readWorkspaceFile("src/components/library/capture-url-form.tsx");
  const createSourceForm = readWorkspaceFile("src/components/library/create-source-form.tsx");

  assert.match(toolbar, /CaptureUrlForm/);
  assert.match(toolbar, /CreateSourceForm/);
  assert.match(toolbar, /xl:grid-cols-\[minmax\(0,1fr\)_minmax\(0,1fr\)\]/);
  assert.match(toolbar, /SelectInput/);
  assert.match(toolbar, /应用筛选/);
  assert.match(toolbar, /清空/);
  assert.match(toolbar, /sortContext/);
  assert.match(toolbar, /showFilters/);
  assert.match(createSourceForm, /添加 RSS 来源/);
  assert.match(createSourceForm, /分类过滤（可选）/);
  assert.match(captureForm, /保存网页链接/);
});

test("sources all page uses the fused source-library document list instead of the source card wall", () => {
  const allDocumentsPage = readWorkspaceFile("src/app/(main)/sources/all/page.tsx");

  assert.match(allDocumentsPage, /SourceLibraryIndex/);
  assert.match(allDocumentsPage, /SourceLibraryToolbar/);
  assert.match(allDocumentsPage, /showFilters/);
  assert.match(allDocumentsPage, /filters=\{data\.filters\}/);
  assert.match(allDocumentsPage, /sortContext="sourceIndex"/);
  assert.match(allDocumentsPage, /返回来源库/);
  assert.doesNotMatch(allDocumentsPage, /DocumentList/);
  assert.doesNotMatch(allDocumentsPage, /SourceLibraryDocumentList/);
});

test("source detail routes and unknown source route use the dedicated detail surface", () => {
  const feedPage = readWorkspaceFile("src/app/(main)/sources/feed/[feedId]/page.tsx");
  const domainPage = readWorkspaceFile("src/app/(main)/sources/domain/[hostname]/page.tsx");
  const unknownPage = readWorkspaceFile("src/app/(main)/sources/unknown/page.tsx");
  const namedSourcePage = readWorkspaceFile("src/app/(main)/sources/[sourceId]/page.tsx");
  const detailComponent = readWorkspaceFile("src/components/library/source-library-detail.tsx");
  const documentList = readWorkspaceFile("src/components/library/document-list.tsx");
  const detailPage = readWorkspaceFile("src/app/(main)/sources/source-detail-page.tsx");
  const detailFilters = readWorkspaceFile("src/components/library/source-library-detail-filters.tsx");

  assert.match(feedPage, /SourceDetailPage/);
  assert.match(feedPage, /kind: "feed"/);
  assert.match(domainPage, /SourceDetailPage/);
  assert.match(domainPage, /kind: "domain"/);
  assert.match(unknownPage, /SourceDetailPage/);
  assert.match(unknownPage, /kind: "unknown"/);
  assert.match(namedSourcePage, /SourceLibraryDetail/);
  assert.match(namedSourcePage, /sourceId/);
  assert.match(namedSourcePage, /shouldEnableContentOriginForSourceDetail/);
  assert.match(namedSourcePage, /enableContentOrigin/);
  assert.match(namedSourcePage, /sync=\{/);
  assert.match(namedSourcePage, /includeCategories=\{/);
  assert.match(namedSourcePage, /meta=\{/);
  assert.doesNotMatch(namedSourcePage, /SourceLibraryToolbar/);
  assert.doesNotMatch(namedSourcePage, /import \{ Panel \}/);
  const sourceCard = readWorkspaceFile("src/components/library/source-library-source-card.tsx");
  assert.match(detailPage, /SourceLibraryDetail/);
  assert.match(detailPage, /getDocuments/);
  assert.match(detailPage, /shouldEnableContentOriginForSourceDetail/);
  assert.match(detailPage, /enableContentOrigin/);
  assert.match(detailPage, /\{sourceContext\.meta\}/);
  assert.doesNotMatch(detailPage, /SourceLibraryToolbar/);
  assert.doesNotMatch(detailPage, /import \{ Panel \}/);
  assert.match(detailPage, /返回来源库/);
  assert.match(detailComponent, /DocumentList/);
  assert.match(detailComponent, /SourceLibraryDetailFilters/);
  assert.doesNotMatch(detailComponent, /SourceLibrarySourceCard/);
  assert.doesNotMatch(detailComponent, /Source detail/);
  assert.doesNotMatch(detailComponent, /SourceLibraryDocumentList/);
  assert.match(sourceCard, /h-\[18rem\]/);
  assert.match(detailFilters, /SelectInput/);
  assert.match(detailFilters, /应用/);
  assert.match(detailFilters, /Clear/);
  assert.doesNotMatch(detailFilters, /文档类型/);
  assert.doesNotMatch(detailFilters, /CaptureUrlForm/);
  assert.doesNotMatch(detailFilters, /CreateSourceForm/);
});

test("qa sources page previews the real source library with dev-only fixture data", () => {
  const qaSourcesPage = readWorkspaceFile("src/app/qa/sources/page.tsx");

  assert.match(qaSourcesPage, /notFound/);
  assert.match(qaSourcesPage, /SourceLibraryIndex/);
  assert.match(qaSourcesPage, /getSourceLibraryQaFixture/);
  assert.match(qaSourcesPage, /NODE_ENV === "production"/);
});

test("source surface ordering is based on ingest recency instead of publishedAt", () => {
  const documentRepository = readWorkspaceFile("src/server/modules/documents/document.repository.ts");

  assert.match(documentRepository, /if \(surface === "source"\)/);
  assert.match(documentRepository, /sort === "earliest" \? \[\{ createdAt: "asc" \}\] : \[\{ createdAt: "desc" \}\]/);
});
