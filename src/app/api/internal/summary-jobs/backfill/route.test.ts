import assert from "node:assert/strict";
import test from "node:test";
import { parseBackfillRun } from "@/app/api/internal/summary-jobs/backfill/params";

test("parseRun defaults to queue-only when omitted", () => {
  assert.equal(parseBackfillRun(null), false);
});

test('parseRun accepts explicit "true" and "false" values', () => {
  assert.equal(parseBackfillRun("true"), true);
  assert.equal(parseBackfillRun("false"), false);
});
