import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readWorkspaceFile(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("transcript queue wiring avoids unsupported Hobby cron usage while keeping manual sweep support safe", () => {
  const vercelConfig = readWorkspaceFile("vercel.json");
  const sourceLibraryMenu = readWorkspaceFile("src/components/library/source-library-more-menu.tsx");
  const captureService = readWorkspaceFile("src/server/modules/capture/capture.service.ts");
  const videoReader = readWorkspaceFile("src/components/reader/video-reader.tsx");

  assert.doesNotMatch(vercelConfig, /"path": "\/api\/internal\/transcript-jobs\/sweep"/);
  assert.doesNotMatch(sourceLibraryMenu, /api\/transcript-jobs\/sweep/);
  assert.doesNotMatch(sourceLibraryMenu, /补跑 AI 队列/);
  assert.doesNotMatch(captureService, /hydrateDocumentTranscriptIfPossible/);
  assert.doesNotMatch(videoReader, /api\/transcript-jobs\/sweep/);
});
