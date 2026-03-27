import assert from "node:assert/strict";
import test from "node:test";
import { RouteError } from "@/server/api/response";
import { readJsonBodyOrThrow } from "@/server/api/request";

test("readJsonBodyOrThrow returns parsed JSON payloads", async () => {
  const request = new Request("http://reader.test/api", {
    method: "POST",
    body: JSON.stringify({ note: "hello" }),
    headers: {
      "content-type": "application/json",
    },
  });

  const payload = await readJsonBodyOrThrow(request);

  assert.deepEqual(payload, { note: "hello" });
});

test("readJsonBodyOrThrow wraps invalid JSON in a RouteError", async () => {
  const request = new Request("http://reader.test/api", {
    method: "PATCH",
    body: "",
    headers: {
      "content-type": "application/json",
    },
  });

  await assert.rejects(
    () => readJsonBodyOrThrow(request, "Highlight update payload must be valid JSON."),
    (error: unknown) => {
      assert.ok(error instanceof RouteError);
      assert.equal(error.code, "INVALID_BODY");
      assert.equal(error.status, 400);
      assert.equal(error.message, "Highlight update payload must be valid JSON.");
      return true;
    },
  );
});
