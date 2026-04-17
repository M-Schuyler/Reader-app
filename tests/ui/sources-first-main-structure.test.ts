import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readWorkspaceFile(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("home and compatibility routes align to the sources-first structure", () => {
  const homePage = readWorkspaceFile("src/app/page.tsx");
  const libraryPage = readWorkspaceFile("src/app/(main)/library/page.tsx");
  const legacyDocumentPage = readWorkspaceFile("src/app/(main)/documents/[id]/page.tsx");
  const readingDetailPage = readWorkspaceFile("src/app/(main)/reading/[id]/page.tsx");

  assert.match(homePage, /redirect\(user \? "\/sources" : "\/login"\)/);
  assert.match(libraryPage, /redirect\("\/sources"\)/);
  assert.match(
    legacyDocumentPage,
    /redirect\(query \? `\/reading\/\$\{resolvedParams\.id\}\?\$\{query\}` : `\/reading\/\$\{resolvedParams\.id\}`\)/,
  );
  assert.match(readingDetailPage, /openReaderDocument/);
  assert.match(readingDetailPage, /<DocumentReader document=\{data\.document\} nextUp=\{data\.nextUp\} \/>/);
});

test("top-level chrome and major document entry points now route through /reading", () => {
  const productShell = readWorkspaceFile("src/lib/product-shell.ts");
  const workspaceChrome = readWorkspaceFile("src/components/layout/main-workspace-chrome.tsx");
  const documentList = readWorkspaceFile("src/components/library/document-list.tsx");
  const globalSearch = readWorkspaceFile("src/components/search/global-search.tsx");
  const highlightsPage = readWorkspaceFile("src/app/(main)/highlights/page.tsx");
  const documentReader = readWorkspaceFile("src/components/reader/document-reader.tsx");
  const sourceAllPage = readWorkspaceFile("src/app/(main)/sources/all/page.tsx");
  const readme = readWorkspaceFile("README.md");

  assert.match(productShell, /pathname === "\/reading" \|\| pathname\.startsWith\("\/reading\/"\)/);
  assert.doesNotMatch(productShell, /pathname\.startsWith\("\/documents\/"\)/);
  assert.match(workspaceChrome, /pathname\.startsWith\("\/reading\/"\)/);

  assert.match(documentList, /href=\{`\/reading\/\$\{item\.id\}`\}/);
  assert.match(globalSearch, /handleSelect\(`\/reading\/\$\{activeResult\.id\}`\)/);
  assert.match(globalSearch, /onClick=\{\(\) => handleSelect\(`\/reading\/\$\{item\.id\}`\)\}/);
  assert.match(highlightsPage, /href=\{`\/reading\/\$\{highlight\.document\.id\}#highlight-\$\{highlight\.id\}`\}/);
  assert.match(documentReader, /href="\/sources"/);
  assert.match(documentReader, /href=\{`\/reading\/\$\{item\.id\}`\}/);
  assert.doesNotMatch(documentReader, /href="\/reading">\s*Library/);
  assert.doesNotMatch(sourceAllPage, /Library \/ All Sources/);

  assert.match(readme, /### Sources/);
  assert.match(readme, /### Reading/);
  assert.doesNotMatch(readme, /### Library/);
  assert.doesNotMatch(readme, /### Reader/);
  assert.match(readme, /keep Sources as the main intake and browsing surface/);
  assert.match(readme, /keep Reading as the active reading flow/);
});
