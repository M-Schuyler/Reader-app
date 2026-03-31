import assert from "node:assert/strict";
import test from "node:test";
import { RouteError } from "@/server/api/response";
import { normalizeCaptureInputUrl } from "@/server/modules/capture/capture.service";

test("normalizeCaptureInputUrl trims input and strips hash", () => {
  const normalized = normalizeCaptureInputUrl("  https://example.com/article#section  ");
  assert.equal(normalized, "https://example.com/article");
});

test("normalizeCaptureInputUrl rejects empty and non-absolute urls", () => {
  assert.throws(
    () => normalizeCaptureInputUrl("   "),
    (error) => error instanceof RouteError && error.code === "INVALID_URL",
  );

  assert.throws(
    () => normalizeCaptureInputUrl("/relative/path"),
    (error) => error instanceof RouteError && error.code === "INVALID_URL",
  );
});

test("normalizeCaptureInputUrl rejects non-http protocols", () => {
  assert.throws(
    () => normalizeCaptureInputUrl("javascript:alert(1)"),
    (error) => error instanceof RouteError && error.code === "INVALID_URL",
  );
});
