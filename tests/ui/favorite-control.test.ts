import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readWorkspaceFile(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("favorite toggle renders a star icon that fills only for the favorited state", () => {
  const favoriteControl = readWorkspaceFile("src/components/documents/favorite-control.tsx");

  assert.match(favoriteControl, /<FavoriteStarIcon isFilled=\{props\.isFavorite\} \/>/);
  assert.match(favoriteControl, /fill=\{isFilled \? "currentColor" : "none"\}/);
  assert.match(favoriteControl, /stroke="currentColor"/);
});
