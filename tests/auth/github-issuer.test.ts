import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

test("GitHub callbacks accept its issuer while rejecting an unrelated issuer", async (t) => {
  const errors: string[] = [];
  t.mock.method(console, "error", (...args: unknown[]) => {
    errors.push(args.map(String).join(" "));
  });
  const saved = Object.fromEntries(
    ["AUTH_SECRET", "AUTH_GITHUB_ID", "AUTH_GITHUB_SECRET"].map((key) => [key, process.env[key]]),
  );
  t.after(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  process.env.AUTH_SECRET = "test-only-secret-for-oauth-regression";
  process.env.AUTH_GITHUB_ID = "test-client";
  process.env.AUTH_GITHUB_SECRET = "test-secret";
  const { handlers } = await import("@/auth");

  async function callback(issuer: string) {
    errors.length = 0;
    const query = new URLSearchParams({ code: "test", iss: issuer });
    await handlers.GET(new NextRequest(`http://localhost:3000/api/auth/callback/github?${query}`));
    return errors.join("\n");
  }

  const githubResult = await callback("https://github.com/login/oauth");
  assert.doesNotMatch(githubResult, /unexpected "iss"/);
  // The synthetic request has no login cookies: reaching PKCE proves issuer
  // validation passed, without exchanging a code or calling GitHub.
  assert.match(githubResult, /pkceCodeVerifier/);

  const unrelatedResult = await callback("https://untrusted.example");
  assert.match(unrelatedResult, /unexpected "iss"/);
});
