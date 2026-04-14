import assert from "node:assert/strict";
import test from "node:test";
import { __documentAiSummaryForTests } from "./document-ai-summary.service";

test("gemini 3.1 flash-lite alias maps to preview model with fallback", () => {
  assert.deepEqual(__documentAiSummaryForTests.resolveGeminiModelConfig("gemini-3.1-flash-lite"), {
    model: "models/gemini-3.1-flash-lite-preview",
    fallbackModels: ["gemini-2.5-flash"],
  });
});

test("gemini 3.1 flash-lite preview alias keeps canonical model id", () => {
  assert.deepEqual(
    __documentAiSummaryForTests.resolveGeminiModelConfig("models/gemini-3.1-flash-lite-preview"),
    {
      model: "models/gemini-3.1-flash-lite-preview",
      fallbackModels: ["gemini-2.5-flash"],
    },
  );
});

test("non-lite gemini model keeps configured value without fallback", () => {
  assert.deepEqual(__documentAiSummaryForTests.resolveGeminiModelConfig("models/gemini-2.5-pro"), {
    model: "models/gemini-2.5-pro",
    fallbackModels: [],
  });
});

test("fallback-to-next-model is enabled only for gemini availability failures", () => {
  assert.equal(__documentAiSummaryForTests.shouldTryNextModelCandidate("gemini", { status: 404 }), true);
  assert.equal(__documentAiSummaryForTests.shouldTryNextModelCandidate("gemini", { status: 503 }), true);
  assert.equal(
    __documentAiSummaryForTests.shouldTryNextModelCandidate("gemini", { message: "Connection error while requesting provider" }),
    true,
  );

  assert.equal(__documentAiSummaryForTests.shouldTryNextModelCandidate("gemini", { status: 429 }), false);
  assert.equal(__documentAiSummaryForTests.shouldTryNextModelCandidate("openai", { status: 404 }), false);
});
