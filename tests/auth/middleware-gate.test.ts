import assert from "node:assert/strict";
import test from "node:test";
import { getAuthMiddlewareDecision } from "@/server/auth/middleware-gate";

test("development bypasses middleware auth for protected pages", () => {
  const decision = getAuthMiddlewareDecision({
    pathname: "/sources",
    search: "",
    origin: "http://localhost:3000",
    isAuthenticated: false,
    nodeEnv: "development",
  });

  assert.deepEqual(decision, {
    type: "next",
  });
});

test("production redirects unauthenticated page requests to login", () => {
  const decision = getAuthMiddlewareDecision({
    pathname: "/sources",
    search: "?page=2",
    origin: "https://reader.iamkai.top",
    isAuthenticated: false,
    nodeEnv: "production",
  });

  assert.deepEqual(decision, {
    type: "redirect",
    location: "https://reader.iamkai.top/login?callbackUrl=%2Fsources%3Fpage%3D2",
  });
});

test("production redirects authenticated login visits to the callback target", () => {
  const decision = getAuthMiddlewareDecision({
    pathname: "/login",
    search: "?callbackUrl=%2Fdocuments%2Fabc",
    origin: "https://reader.iamkai.top",
    isAuthenticated: true,
    nodeEnv: "production",
  });

  assert.deepEqual(decision, {
    type: "redirect",
    location: "https://reader.iamkai.top/documents/abc",
  });
});

test("production returns unauthorized for protected api routes", () => {
  const decision = getAuthMiddlewareDecision({
    pathname: "/api/summary-jobs/status",
    search: "",
    origin: "https://reader.iamkai.top",
    isAuthenticated: false,
    nodeEnv: "production",
  });

  assert.deepEqual(decision, {
    type: "unauthorized",
  });
});
