import assert from "node:assert/strict";
import test from "node:test";
import { ReadState } from "@prisma/client";
import {
  resolveDocumentReadCompletionPhase,
  shouldTriggerDocumentReadCompletion,
  type DocumentReadCompletionGeometry,
} from "./use-document-read-completion";

function createGeometry(overrides: Partial<DocumentReadCompletionGeometry> = {}): DocumentReadCompletionGeometry {
  return {
    isEnabled: true,
    isTriggered: false,
    readState: ReadState.UNREAD,
    sentinelTop: 980,
    viewportBottom: 1000,
    ...overrides,
  };
}

test("shouldTriggerDocumentReadCompletion waits for the extra pull past the footer", () => {
  assert.equal(
    shouldTriggerDocumentReadCompletion(
      createGeometry({
        sentinelTop: 940,
        viewportBottom: 1010,
      }),
    ),
    false,
  );

  assert.equal(
    shouldTriggerDocumentReadCompletion(
      createGeometry({
        sentinelTop: 900,
        viewportBottom: 1000,
      }),
    ),
    true,
  );
});

test("shouldTriggerDocumentReadCompletion stays off for already-read, unreadable, and already-triggered states", () => {
  assert.equal(
    shouldTriggerDocumentReadCompletion(
      createGeometry({
        isEnabled: false,
        sentinelTop: 900,
        viewportBottom: 1000,
      }),
    ),
    false,
  );
  assert.equal(
    shouldTriggerDocumentReadCompletion(
      createGeometry({
        readState: ReadState.READ,
        sentinelTop: 900,
        viewportBottom: 1000,
      }),
    ),
    false,
  );
  assert.equal(
    shouldTriggerDocumentReadCompletion(
      createGeometry({
        isTriggered: true,
        sentinelTop: 900,
        viewportBottom: 1000,
      }),
    ),
    false,
  );
});

test("resolveDocumentReadCompletionPhase arms near the footer before the final trigger", () => {
  assert.equal(
    resolveDocumentReadCompletionPhase(
      "idle",
      createGeometry({
        sentinelTop: 980,
        viewportBottom: 1000,
      }),
    ),
    "armed",
  );

  assert.equal(
    resolveDocumentReadCompletionPhase(
      "idle",
      createGeometry({
        sentinelTop: 900,
        viewportBottom: 1000,
      }),
    ),
    "animating",
  );
});
