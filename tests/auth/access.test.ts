import assert from "node:assert/strict";
import test from "node:test";
import {
  getAuthenticatedUserFromSession,
  getAllowedEmails,
  hasAllowedEmailsConfigured,
  isAllowedSession,
  sanitizeCallbackUrl,
} from "@/server/auth/access";

const ORIGINAL_ENV = {
  NODE_ENV: process.env.NODE_ENV,
  ALLOWED_EMAILS: process.env.ALLOWED_EMAILS,
  DEV_LOCAL_AUTH_EMAIL: process.env.DEV_LOCAL_AUTH_EMAIL,
};
const MUTABLE_ENV = process.env as Record<string, string | undefined>;

test.afterEach(() => {
  MUTABLE_ENV.NODE_ENV = ORIGINAL_ENV.NODE_ENV;
  restoreEnv("ALLOWED_EMAILS", ORIGINAL_ENV.ALLOWED_EMAILS);
  restoreEnv("DEV_LOCAL_AUTH_EMAIL", ORIGINAL_ENV.DEV_LOCAL_AUTH_EMAIL);
});

test("allowed email configuration stays empty without envs", () => {
  MUTABLE_ENV.NODE_ENV = "development";
  delete process.env.ALLOWED_EMAILS;
  delete process.env.DEV_LOCAL_AUTH_EMAIL;

  assert.equal(hasAllowedEmailsConfigured(), false);
  assert.deepEqual([...getAllowedEmails()], []);
  assert.equal(isAllowedSession(null), false);
  assert.equal(getAuthenticatedUserFromSession(null), null);
});

test("dev local auth email enables local access without a session in development", () => {
  MUTABLE_ENV.NODE_ENV = "development";
  delete process.env.ALLOWED_EMAILS;
  process.env.DEV_LOCAL_AUTH_EMAIL = "mentor@example.com";

  assert.equal(hasAllowedEmailsConfigured(), true);
  assert.equal(isAllowedSession(null), true);
  assert.deepEqual(getAuthenticatedUserFromSession(null), {
    email: "mentor@example.com",
    name: "Local Dev",
    image: null,
  });
});

test("production ignores dev local auth bypass", () => {
  MUTABLE_ENV.NODE_ENV = "production";
  delete process.env.ALLOWED_EMAILS;
  process.env.DEV_LOCAL_AUTH_EMAIL = "mentor@example.com";

  assert.equal(hasAllowedEmailsConfigured(), false);
  assert.equal(isAllowedSession(null), false);
  assert.equal(getAuthenticatedUserFromSession(null), null);
});

test("sanitizeCallbackUrl prevents redirect loops back to login", () => {
  assert.equal(sanitizeCallbackUrl("/login"), "/sources");
  assert.equal(sanitizeCallbackUrl("/login?callbackUrl=%2Fsources"), "/sources");
  assert.equal(sanitizeCallbackUrl("/sources"), "/sources");
  assert.equal(sanitizeCallbackUrl("/documents/abc"), "/documents/abc");
});

function restoreEnv(key: "ALLOWED_EMAILS" | "DEV_LOCAL_AUTH_EMAIL", value: string | undefined) {
  if (typeof value === "undefined") {
    delete process.env[key];
    return;
  }

  process.env[key] = value;
}
