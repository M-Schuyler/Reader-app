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
  assert.doesNotMatch(sourcesPage, /Source filters/);
  assert.doesNotMatch(sourcesPage, /xl:grid-cols-\[22rem_minmax\(0,1fr\)\]/);
});

test("source library index uses large clickable source cards instead of inline article lists", () => {
  const toolbar = readWorkspaceFile("src/components/library/source-library-toolbar.tsx");
  const sourceLibrary = readWorkspaceFile("src/components/library/source-library.tsx");
  const sourceCard = readWorkspaceFile("src/components/library/source-library-source-card.tsx");

  assert.match(toolbar, /CaptureUrlForm/);
  assert.match(toolbar, /variant="compact"/);
  assert.match(toolbar, /最近收进来/);
  assert.match(sourceLibrary, /近七天/);
  assert.match(sourceLibrary, /更早/);
  assert.match(sourceLibrary, /SourceLibraryIndex/);
  assert.match(sourceLibrary, /SourceLibraryIndexCard/);
  assert.match(sourceLibrary, /href=\{group\.href/);
  assert.match(sourceLibrary, /grid-cols-\[repeat\(auto-fit,minmax\(15rem,1fr\)\)\]/);
  assert.doesNotMatch(sourceLibrary, /SourceLibraryItemCard/);
  assert.doesNotMatch(sourceLibrary, /divide-y divide-\[color:var\(--border-subtle\)\]/);
  assert.match(sourceCard, /h-\[17\.5rem\]/);
  assert.match(sourceCard, /group-hover:shadow-\[var\(--shadow-surface\)\]/);
});

test("source detail routes use a dedicated detail surface", () => {
  const feedPage = readWorkspaceFile("src/app/(main)/sources/feed/[feedId]/page.tsx");
  const domainPage = readWorkspaceFile("src/app/(main)/sources/domain/[hostname]/page.tsx");
  const detailComponent = readWorkspaceFile("src/components/library/source-library-detail.tsx");
  const detailPage = readWorkspaceFile("src/app/(main)/sources/source-detail-page.tsx");

  assert.match(feedPage, /SourceDetailPage/);
  assert.match(feedPage, /kind: "feed"/);
  assert.match(domainPage, /SourceDetailPage/);
  assert.match(domainPage, /kind: "domain"/);
  assert.match(detailPage, /SourceLibraryDetail/);
  assert.match(detailPage, /getDocuments/);
  assert.match(detailComponent, /SourceLibraryDocumentList/);
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
