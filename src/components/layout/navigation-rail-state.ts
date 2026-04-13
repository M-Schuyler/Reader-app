export type NavigationRailVisualState = "full" | "weakened";

export function resolveNavigationRailVisualState(input: {
  pathname: string;
  nearTop: boolean;
  scrollingDown: boolean;
  searchOpen: boolean;
  accountMenuOpen: boolean;
  pointerInside: boolean;
}): NavigationRailVisualState {
  const isReadingPage = input.pathname.startsWith("/documents/");

  if (!isReadingPage) {
    return "full";
  }

  if (input.nearTop) {
    return "full";
  }

  if (input.searchOpen || input.accountMenuOpen || input.pointerInside) {
    return "full";
  }

  return input.scrollingDown ? "weakened" : "full";
}
