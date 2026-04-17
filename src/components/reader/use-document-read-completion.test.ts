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
    scrollY: 0,
    scrollableHeight: 2000,
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
        sentinelTop: 870,
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
        scrollY: 420,
        sentinelTop: 900,
        viewportBottom: 1000,
      }),
    ),
    false,
  );
});

test("shouldTriggerDocumentReadCompletion does not fire on initial tiny layout before content expands", () => {
  assert.equal(
    shouldTriggerDocumentReadCompletion(
      createGeometry({
        scrollY: 0,
        scrollableHeight: 46,
        sentinelTop: 488,
        viewportBottom: 720,
      }),
    ),
    false,
  );
});

test("short documents only trigger completion after the reader actually scrolls to bottom", () => {
  assert.equal(
    shouldTriggerDocumentReadCompletion(
      createGeometry({
        scrollY: 0,
        scrollableHeight: 46,
        sentinelTop: 488,
        viewportBottom: 720,
      }),
    ),
    false,
  );

  assert.equal(
    shouldTriggerDocumentReadCompletion(
      createGeometry({
        scrollY: 46,
        scrollableHeight: 46,
        sentinelTop: 534,
        viewportBottom: 766,
      }),
    ),
    true,
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
        sentinelTop: 870,
        viewportBottom: 1000,
      }),
    ),
    "animating",
  );
});
