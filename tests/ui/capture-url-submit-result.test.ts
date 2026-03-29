import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolveCaptureUrlSubmitSuccess } from "@/lib/capture/capture-url-submit-result";

function readWorkspaceFile(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("deduped capture responses surface an existing-article jump action", () => {
  assert.deepEqual(
    resolveCaptureUrlSubmitSuccess({
      deduped: true,
      document: {
        id: "doc-existing",
      },
    }),
    {
      actionHref: "/documents/doc-existing",
      actionLabel: "前往已有文章",
      kind: "deduped",
      message: "这篇文章已收藏，不再重复导入。",
    },
  );
});

test("new capture responses keep redirecting back to sources", () => {
  assert.deepEqual(
    resolveCaptureUrlSubmitSuccess({
      deduped: false,
      document: {
        id: "doc-new",
      },
    }),
    {
      href: "/sources",
      kind: "redirect",
    },
  );
});

test("capture form renders the dedupe recovery action instead of silently redirecting", () => {
  const captureUrlForm = readWorkspaceFile("src/components/library/capture-url-form.tsx");
  const submitResult = readWorkspaceFile("src/lib/capture/capture-url-submit-result.ts");

  assert.match(captureUrlForm, /resolveCaptureUrlSubmitSuccess/);
  assert.match(captureUrlForm, /success\.actionHref/);
  assert.match(submitResult, /前往已有文章/);
  assert.match(submitResult, /这篇文章已收藏，不再重复导入。/);
});
