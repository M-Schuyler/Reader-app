import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readWorkspaceFile(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("sources page uses the dedicated source library components instead of the shared reading list", () => {
  const sourcesPage = readWorkspaceFile("src/app/(main)/sources/page.tsx");

  assert.match(sourcesPage, /SourceLibraryToolbar/);
  assert.match(sourcesPage, /SourceLibrary/);
  assert.doesNotMatch(sourcesPage, /DocumentList/);
  assert.doesNotMatch(sourcesPage, /Source filters/);
  assert.doesNotMatch(sourcesPage, /xl:grid-cols-\[22rem_minmax\(0,1fr\)\]/);
});

test("source library toolbar and shelves expose the new bookroom structure", () => {
  const toolbar = readWorkspaceFile("src/components/library/source-library-toolbar.tsx");
  const sourceLibrary = readWorkspaceFile("src/components/library/source-library.tsx");

  assert.match(toolbar, /CaptureUrlForm/);
  assert.match(toolbar, /variant="compact"/);
  assert.match(toolbar, /最近收进来/);
  assert.match(sourceLibrary, /近七天/);
  assert.match(sourceLibrary, /更早/);
  assert.match(sourceLibrary, /SourceLibraryShelf/);
  assert.match(sourceLibrary, /SourceLibrarySourceGroup/);
  assert.match(sourceLibrary, /SourceLibraryItemCard/);
  assert.match(sourceLibrary, /SourceLibraryCover/);
  assert.match(sourceLibrary, /w-\[8\.75rem\]/);
  assert.match(sourceLibrary, /h-\[11\.5rem\]/);
  assert.match(sourceLibrary, /sm:items-start/);
  assert.match(sourceLibrary, /line-clamp-6/);
  assert.match(sourceLibrary, /divide-y divide-\[color:var\(--border-subtle\)\]/);
  assert.match(sourceLibrary, /SourceLibrarySourceItems/);
});

test("qa sources page previews the real source library with dev-only fixture data", () => {
  const qaSourcesPage = readWorkspaceFile("src/app/qa/sources/page.tsx");

  assert.match(qaSourcesPage, /notFound/);
  assert.match(qaSourcesPage, /SourceLibrary/);
  assert.match(qaSourcesPage, /getSourceLibraryQaFixture/);
  assert.match(qaSourcesPage, /NODE_ENV === "production"/);
});
