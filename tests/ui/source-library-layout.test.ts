import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readWorkspaceFile(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("sources page uses the dedicated source index view with a compact overflow action menu", () => {
  const sourcesPage = readWorkspaceFile("src/app/(main)/sources/page.tsx");

  assert.match(sourcesPage, /SourceLibraryToolbar/);
  assert.match(sourcesPage, /SourceLibraryIndex/);
  assert.match(sourcesPage, /SourceLibraryMoreMenu/);
  assert.match(sourcesPage, /getSourceLibraryIndex/);
  assert.match(sourcesPage, /这里只展示最近 7 天仍有新内容进入库的来源/);
  assert.doesNotMatch(sourcesPage, /getDocuments\(\{/);
  assert.doesNotMatch(sourcesPage, /DocumentList/);
  assert.doesNotMatch(sourcesPage, /最近收进来/);
  assert.doesNotMatch(sourcesPage, /近七天/);
  assert.doesNotMatch(sourcesPage, /更早/);
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
  assert.doesNotMatch(sourceLibrary, /SOURCE_SHELF_META/);
  assert.doesNotMatch(sourceLibrary, /最近收进来/);
  assert.doesNotMatch(sourceLibrary, /近七天/);
  assert.doesNotMatch(sourceLibrary, /label:\s*"更早"/);
  assert.match(sourceCard, /h-\[17\.5rem\]/);
});

test("source library toolbar supports an index-only mode with just the two capture forms", () => {
  const toolbar = readWorkspaceFile("src/components/library/source-library-toolbar.tsx");
  const captureForm = readWorkspaceFile("src/components/library/capture-url-form.tsx");
  const createSourceForm = readWorkspaceFile("src/components/library/create-source-form.tsx");

  assert.match(toolbar, /CaptureUrlForm/);
  assert.match(toolbar, /CreateSourceForm/);
  assert.match(toolbar, /variant="compact"/);
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

  assert.match(allDocumentsPage, /SourceLibraryDocumentList/);
  assert.match(allDocumentsPage, /SourceLibraryToolbar/);
  assert.match(allDocumentsPage, /showFilters/);
  assert.match(allDocumentsPage, /filters=\{data\.filters\}/);
  assert.match(allDocumentsPage, /sortContext="documentList"/);
  assert.match(allDocumentsPage, /返回来源库/);
  assert.match(allDocumentsPage, /pagination\.total/);
  assert.match(allDocumentsPage, /上一页/);
  assert.match(allDocumentsPage, /下一页/);
  assert.doesNotMatch(allDocumentsPage, /SourceLibraryIndex/);
  assert.doesNotMatch(allDocumentsPage, /import\s+\{\s*DocumentList\s*\}/);
});

test("source detail routes and unknown source route use the dedicated detail surface", () => {
  const feedPage = readWorkspaceFile("src/app/(main)/sources/feed/[feedId]/page.tsx");
  const domainPage = readWorkspaceFile("src/app/(main)/sources/domain/[hostname]/page.tsx");
  const unknownPage = readWorkspaceFile("src/app/(main)/sources/unknown/page.tsx");
  const namedSourcePage = readWorkspaceFile("src/app/(main)/sources/[sourceId]/page.tsx");
  const detailComponent = readWorkspaceFile("src/components/library/source-library-detail.tsx");
  const documentList = readWorkspaceFile("src/components/library/source-library-document-list.tsx");
  const detailPage = readWorkspaceFile("src/app/(main)/sources/source-detail-page.tsx");

  assert.match(feedPage, /SourceDetailPage/);
  assert.match(feedPage, /kind: "feed"/);
  assert.match(domainPage, /SourceDetailPage/);
  assert.match(domainPage, /kind: "domain"/);
  assert.match(unknownPage, /SourceDetailPage/);
  assert.match(unknownPage, /kind: "unknown"/);
  assert.match(namedSourcePage, /SourceLibraryDetail/);
  assert.match(namedSourcePage, /sourceId/);
  assert.match(namedSourcePage, /sync=\{/);
  assert.match(namedSourcePage, /includeCategories=\{/);
  assert.match(detailPage, /SourceLibraryDetail/);
  assert.match(detailPage, /getDocuments/);
  assert.match(detailComponent, /SourceLibraryDocumentList/);
  assert.match(detailComponent, /getSourceLibraryToneForSeed\(source\.id\)/);
  assert.match(detailComponent, /toneSeed=\{source\.id\}/);
  assert.match(detailComponent, /返回来源库/);
  assert.match(documentList, /toneSeed\?: string/);
  assert.match(documentList, /getSourceLibraryToneForSeed\(toneSeed\)/);
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
