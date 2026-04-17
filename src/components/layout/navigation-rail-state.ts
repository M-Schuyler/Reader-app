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

  const isReadingSurface = input.pathname === "/reading" || input.pathname.startsWith("/reading/");

  // Only the reading surface fades the rail back while the user is moving deeper into content.
  return isReadingSurface && input.scrollingDown ? "weakened" : "full";
}
