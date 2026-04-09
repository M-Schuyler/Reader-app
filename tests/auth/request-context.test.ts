import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTH_REQUEST_PATHNAME_HEADER,
  AUTH_REQUEST_SEARCH_HEADER,
  buildPageLoginRedirectPath,
  withAuthRequestContext,
} from "@/server/auth/request-context";

test("buildPageLoginRedirectPath preserves document deep links", () => {
  assert.equal(
    buildPageLoginRedirectPath({
      pathname: "/documents/abc",
      search: "?view=reader&tag=ai",
    }),
    "/login?callbackUrl=%2Fdocuments%2Fabc%3Fview%3Dreader%26tag%3Dai",
  );
});

test("buildPageLoginRedirectPath falls back to plain login for login routes", () => {
  assert.equal(
    buildPageLoginRedirectPath({
      pathname: "/login",
      search: "?callbackUrl=%2Fsources",
    }),
    "/login",
  );
});

test("buildPageLoginRedirectPath falls back to plain login without request context", () => {
  assert.equal(
    buildPageLoginRedirectPath({
      pathname: null,
      search: null,
    }),
    "/login",
  );
});

test("withAuthRequestContext forwards pathname and search to downstream guards", () => {
  const headers = withAuthRequestContext(new Headers(), {
    pathname: "/sources",
    search: "?page=2&tag=ai",
  });

  assert.equal(headers.get(AUTH_REQUEST_PATHNAME_HEADER), "/sources");
  assert.equal(headers.get(AUTH_REQUEST_SEARCH_HEADER), "?page=2&tag=ai");
});
