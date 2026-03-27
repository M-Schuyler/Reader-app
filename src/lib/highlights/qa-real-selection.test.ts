import assert from "node:assert/strict";
import test from "node:test";
import { pickQaRealDocumentCandidate } from "./qa-real-selection";

test("pickQaRealDocumentCandidate returns the newest readable document without highlights", () => {
  const candidate = pickQaRealDocumentCandidate([
    { id: "doc-with-highlights", highlightCount: 2 },
    { id: "doc-clean", highlightCount: 0 },
  ]);

  assert.equal(candidate, "doc-clean");
});

test("pickQaRealDocumentCandidate refuses to fall back to documents that already carry highlights", () => {
  const candidate = pickQaRealDocumentCandidate([
    { id: "doc-with-highlights", highlightCount: 1 },
    { id: "another-annotated-doc", highlightCount: 3 },
  ]);

  assert.equal(candidate, null);
});
