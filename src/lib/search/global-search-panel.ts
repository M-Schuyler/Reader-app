export type GlobalSearchPanelInput = {
  open: boolean;
  query: string;
  isLoading: boolean;
  resultsCount: number;
  error: string | null;
};

export type GlobalSearchPanelState =
  | { kind: "closed" }
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
    return { kind: "closed" };
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
