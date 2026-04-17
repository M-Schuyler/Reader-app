import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readWorkspaceFile(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("video reader keeps youtube full-sync and bilibili manual-sync branches explicit", () => {
  const source = readWorkspaceFile("src/components/reader/video-reader.tsx");

  assert.match(source, /TRANSCRIPT_PENDING_POLL_INTERVAL_MS/);
  assert.match(source, /fetch\("\/api\/transcript-jobs\/sweep", \{ method: "POST" \}\)/);
  assert.match(source, /const isYouTubeFullSync = videoEmbed\.provider === "youtube" && videoEmbed\.syncMode === "full"/);
  assert.match(source, /YouTube 同步模式：点击字幕可跳转到对应时间点，并随播放进度自动高亮/);
  assert.match(source, /B 站手动模式：当前仅提供播放器与字幕阅读，不承诺自动时间同步/);
  assert.match(source, /当前还没拿到可用字幕/);
  assert.match(source, /YouTube 暂时拦截了字幕抓取/);
  assert.match(source, /markDocumentAsRead/);
  assert.match(source, /VIDEO_READ_THRESHOLD/);
  assert.match(source, /inline-block rounded-\[10px\]/);
  assert.doesNotMatch(source, /w-full rounded-\[14px\]/);
  assert.match(source, /sticky top-\[78px\] z-20/);
});
