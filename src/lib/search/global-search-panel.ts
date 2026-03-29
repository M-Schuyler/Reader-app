export type GlobalSearchPanelInput = {
  open: boolean;
  query: string;
  isLoading: boolean;
  resultsCount: number;
  error: string | null;
};

export type GlobalSearchPanelState =
  | { kind: "closed" }
  | {
      kind: "idle";
      title: "输入关键词开始搜索";
      description: "可搜索标题、AI 摘要、正文和来源。";
    }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "empty"; message: "没有匹配结果。" }
  | { kind: "results" };

export function resolveGlobalSearchPanelState(input: GlobalSearchPanelInput): GlobalSearchPanelState {
  if (!input.open) {
    return { kind: "closed" };
  }

  const trimmedQuery = input.query.trim();
  if (!trimmedQuery) {
    return {
      kind: "idle",
      title: "输入关键词开始搜索",
      description: "可搜索标题、AI 摘要、正文和来源。",
    };
  }

  if (input.isLoading) {
    return { kind: "loading" };
  }

  if (input.error) {
    return {
      kind: "error",
      message: input.error,
    };
  }

  if (input.resultsCount === 0) {
    return {
      kind: "empty",
      message: "没有匹配结果。",
    };
  }

  return { kind: "results" };
}
