import assert from "node:assert/strict";
import test from "node:test";
import { resolveNavigationRailVisualState } from "./navigation-rail-state";

test("only reading pages can enter weakened rail state", () => {
  assert.equal(
    resolveNavigationRailVisualState({
      pathname: "/sources",
      nearTop: false,
      scrollingDown: true,
      searchOpen: false,
      accountMenuOpen: false,
      pointerInside: false,
    }),
    "full",
  );
});

test("reading pages weaken the rail only while scrolling down away from top", () => {
  assert.equal(
    resolveNavigationRailVisualState({
      pathname: "/reading",
      nearTop: false,
      scrollingDown: true,
      searchOpen: false,
      accountMenuOpen: false,
      pointerInside: false,
    }),
    "weakened",
  );

  assert.equal(
    resolveNavigationRailVisualState({
      pathname: "/reading/doc-123",
      nearTop: false,
      scrollingDown: true,
      searchOpen: false,
      accountMenuOpen: false,
      pointerInside: false,
    }),
    "weakened",
  );

  assert.equal(
    resolveNavigationRailVisualState({
      pathname: "/reading/doc-123",
      nearTop: false,
      scrollingDown: true,
      searchOpen: true,
      accountMenuOpen: false,
      pointerInside: false,
    }),
    "full",
  );

  assert.equal(
    resolveNavigationRailVisualState({
      pathname: "/reading/doc-123",
      nearTop: false,
      scrollingDown: true,
      searchOpen: false,
      accountMenuOpen: true,
      pointerInside: false,
    }),
    "full",
  );
});
