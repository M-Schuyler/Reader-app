import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readWorkspaceFile(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("sources page uses the dedicated source library components instead of the shared reading list", () => {
  const sourcesPage = readWorkspaceFile("src/app/(main)/sources/page.tsx");

  assert.match(sourcesPage, /SourceLibraryToolbar/);
  assert.match(sourcesPage, /SourceLibraryIndex/);
  assert.doesNotMatch(sourcesPage, /DocumentList/);
  assert.doesNotMatch(sourcesPage, /PageHeader/);
  assert.doesNotMatch(sourcesPage, /当前共有/);
  assert.doesNotMatch(sourcesPage, /它们先按收入库的时间排成书架/);
});

test("source library index uses large clickable source cards instead of inline article lists", () => {
  const toolbar = readWorkspaceFile("src/components/library/source-library-toolbar.tsx");
  const sourceLibrary = readWorkspaceFile("src/components/library/source-library.tsx");
  const sourceCard = readWorkspaceFile("src/components/library/source-library-source-card.tsx");
  const captureForm = readWorkspaceFile("src/components/library/capture-url-form.tsx");
  const createSourceForm = readWorkspaceFile("src/components/library/create-source-form.tsx");

  assert.match(toolbar, /CaptureUrlForm/);
  assert.match(toolbar, /CreateSourceForm/);
  assert.match(toolbar, /variant="compact"/);
  assert.doesNotMatch(toolbar, /Browse/);
  assert.doesNotMatch(toolbar, /Shelves/);
  assert.doesNotMatch(toolbar, /收得安静一点，找得快一点/);
  assert.doesNotMatch(captureForm, /真正开始读的时候再进入 Reading/);
  assert.doesNotMatch(captureForm, />\s*Capture\s*</);
  assert.match(sourceLibrary, /SourceLibraryIndex/);
  assert.match(sourceLibrary, /SourceLibraryIndexCard/);
  assert.match(sourceLibrary, /href=\{group\.href/);
  assert.match(sourceLibrary, /filterSummary=\{group\.filterSummary\}/);
  assert.match(sourceLibrary, /getSourceLibraryToneForSeed\(group\.id\)/);
  assert.match(sourceLibrary, /grid-cols-\[repeat\(auto-fit,minmax\(15rem,1fr\)\)\]/);
  assert.doesNotMatch(sourceLibrary, /先看有哪些来源被新收进来/);
  assert.doesNotMatch(sourceLibrary, /这一周的内容先按来源排成一级书架/);
  assert.doesNotMatch(sourceLibrary, /更早收入库的来源退到后排/);
  assert.doesNotMatch(sourceLibrary, /Source Library/);
  assert.doesNotMatch(sourceLibrary, /SourceLibraryItemCard/);
  assert.doesNotMatch(sourceLibrary, /divide-y divide-\[color:var\(--border-subtle\)\]/);
  assert.match(sourceCard, /h-\[17\.5rem\]/);
  assert.match(sourceCard, /filterSummary\?: string \| null/);
  assert.match(sourceCard, /filterSummary \? <p/);
  assert.match(sourceCard, /\[overflow-wrap:anywhere\]/);
  assert.match(sourceCard, /group-hover:shadow-\[var\(--shadow-surface\)\]/);
  assert.match(createSourceForm, /添加 RSS 来源/);
  assert.match(createSourceForm, /分类过滤（可选）/);
  assert.match(createSourceForm, /Tech, Reviews/);
  assert.match(createSourceForm, /POST/);
});

test("source detail routes use a dedicated detail surface", () => {
  const feedPage = readWorkspaceFile("src/app/(main)/sources/feed/[feedId]/page.tsx");
  const domainPage = readWorkspaceFile("src/app/(main)/sources/domain/[hostname]/page.tsx");
  const namedSourcePage = readWorkspaceFile("src/app/(main)/sources/[sourceId]/page.tsx");
  const detailComponent = readWorkspaceFile("src/components/library/source-library-detail.tsx");
  const documentList = readWorkspaceFile("src/components/library/source-library-document-list.tsx");
  const detailPage = readWorkspaceFile("src/app/(main)/sources/source-detail-page.tsx");

  assert.match(feedPage, /SourceDetailPage/);
  assert.match(feedPage, /kind: "feed"/);
  assert.match(domainPage, /SourceDetailPage/);
  assert.match(domainPage, /kind: "domain"/);
  assert.match(namedSourcePage, /SourceLibraryDetail/);
  assert.match(namedSourcePage, /sourceId/);
  assert.match(namedSourcePage, /sync=\{/);
  assert.match(namedSourcePage, /includeCategories=\{/);
  assert.match(detailPage, /SourceLibraryDetail/);
  assert.match(detailPage, /getDocuments/);
  assert.match(detailComponent, /SourceLibraryDocumentList/);
  assert.match(detailComponent, /getSourceLibraryToneForSeed\(source\.id\)/);
  assert.match(detailComponent, /toneSeed=\{source\.id\}/);
  assert.match(detailComponent, /分类过滤/);
  assert.match(detailComponent, /当前来源同步时只会保留这些分类/);
  assert.match(detailComponent, /\[overflow-wrap:anywhere\]/);
  assert.match(documentList, /toneSeed\?: string/);
  assert.match(documentList, /getSourceLibraryToneForSeed\(toneSeed\)/);
  assert.match(detailComponent, /返回来源库/);
  assert.match(detailComponent, /Source detail/);
});

test("qa sources page previews the real source library with dev-only fixture data", () => {
  const qaSourcesPage = readWorkspaceFile("src/app/qa/sources/page.tsx");

  assert.match(qaSourcesPage, /notFound/);
  assert.match(qaSourcesPage, /SourceLibrary/);
  assert.match(qaSourcesPage, /getSourceLibraryQaFixture/);
  assert.match(qaSourcesPage, /NODE_ENV === "production"/);
});
