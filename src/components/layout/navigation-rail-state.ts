export type NavigationRailVisualState = "full" | "weakened";

export function resolveNavigationRailVisualState(input: {
  pathname: string;
  nearTop: boolean;
  scrollingDown: boolean;
  searchOpen: boolean;
  accountMenuOpen: boolean;
  pointerInside: boolean;
}): NavigationRailVisualState {
  // If the user is at the very top or interacting with the rail, always show it full.
  if (input.nearTop || input.searchOpen || input.accountMenuOpen || input.pointerInside) {
    return "full";
  }

  // Fade and indent when scrolling down on any page to focus on content.
  return input.scrollingDown ? "weakened" : "full";
}
