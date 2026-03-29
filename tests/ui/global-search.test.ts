import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolveGlobalSearchPanelState } from "@/lib/search/global-search-panel";

function readWorkspaceFile(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("global search opens an idle panel when focused before typing", () => {
  assert.deepEqual(
    resolveGlobalSearchPanelState({
      error: null,
      isLoading: false,
      open: true,
      query: "",
      resultsCount: 0,
    }),
    {
      description: "可搜索标题、AI 摘要、正文和来源。",
      kind: "idle",
      title: "输入关键词开始搜索",
    },
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

test("global search component wires the top search button to focus and open the panel", () => {
  const component = readWorkspaceFile("src/components/search/global-search.tsx");
  const panelState = readWorkspaceFile("src/lib/search/global-search-panel.ts");

  assert.match(component, /resolveGlobalSearchPanelState/);
  assert.match(component, /const inputRef = useRef<HTMLInputElement>\(null\)/);
  assert.match(component, /function focusSearch\(\)/);
  assert.match(component, /setOpen\(true\)/);
  assert.match(component, /inputRef\.current\?\.focus\(\)/);
  assert.match(component, /aria-label="打开搜索"/);
  assert.match(component, /lg:min-w-\[15rem\]/);
  assert.match(panelState, /输入关键词开始搜索/);
});
