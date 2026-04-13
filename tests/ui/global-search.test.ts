import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolveGlobalSearchPanelState } from "@/lib/search/global-search-panel";

function readWorkspaceFile(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("global search stays visually quiet before typing", () => {
  assert.deepEqual(
    resolveGlobalSearchPanelState({
      error: null,
      isLoading: false,
      open: true,
      query: "",
      resultsCount: 0,
    }),
    { kind: "closed" },
  );
});

test("global search resolves loading, empty, and results states once a query exists", () => {
  assert.deepEqual(
    resolveGlobalSearchPanelState({
      error: null,
      isLoading: true,
      open: true,
      query: "kai",
      resultsCount: 0,
    }),
    { kind: "loading" },
  );

  assert.deepEqual(
    resolveGlobalSearchPanelState({
      error: null,
      isLoading: false,
      open: true,
      query: "kai",
      resultsCount: 0,
    }),
    {
      kind: "empty",
      message: "没有匹配结果。",
    },
  );

  assert.deepEqual(
    resolveGlobalSearchPanelState({
      error: null,
      isLoading: false,
      open: true,
      query: "kai",
      resultsCount: 3,
    }),
    { kind: "results" },
  );
});

test("global search becomes a controlled overlay instead of a permanent top input", () => {
  const component = readWorkspaceFile("src/components/search/global-search.tsx");

  assert.match(component, /type GlobalSearchProps = \{/);
  assert.match(component, /open: boolean/);
  assert.match(component, /onOpenChange: \(open: boolean\) => void/);
  assert.match(component, /fixed inset-0/);
  assert.match(component, /placeholder="搜索文档"/);
  assert.doesNotMatch(component, /min-h-9 rounded-full border-stone-200 bg-white\/80/);
});

test("workspace chrome owns the global search open state", () => {
  const chrome = readWorkspaceFile("src/components/layout/main-workspace-chrome.tsx");

  assert.match(chrome, /const \[searchOpen, setSearchOpen\] = useState\(false\)/);
  assert.match(chrome, /<GlobalSearch onOpenChange=\{setSearchOpen\} open=\{searchOpen\} \/>/);
  assert.match(chrome, /onSearchOpen=\{\(\) => setSearchOpen\(true\)\}/);
});
