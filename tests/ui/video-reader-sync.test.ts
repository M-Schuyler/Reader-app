import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readWorkspaceFile(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("video reader keeps youtube full-sync and bilibili manual-sync branches explicit", () => {
  const source = readWorkspaceFile("src/components/reader/video-reader.tsx");

  assert.match(source, /const isYouTubeFullSync = videoEmbed\.provider === "youtube" && videoEmbed\.syncMode === "full"/);
  assert.match(source, /YouTube 原生字幕：点击字幕可跳转到对应时间点，并随播放进度自动高亮/);
  assert.match(source, /当前视频带有原生字幕。你可以按时间阅读；由于播放器限制，暂不承诺自动同步/);
  assert.match(source, /当前视频没有可验证字幕。Reader 仅保留播放器、元数据和原始链接/);
  assert.match(source, /markDocumentAsRead/);
  assert.match(source, /VIDEO_READ_THRESHOLD/);
  assert.match(source, /grid w-full grid-cols-\[auto_1fr\] items-start gap-3 rounded-\[14px\]/);
  assert.match(source, /tabular-nums/);
  assert.doesNotMatch(source, /inline-block rounded-\[10px\]/);
  assert.match(source, /sticky top-\[78px\] z-20/);
  assert.doesNotMatch(source, /TRANSCRIPT_PENDING_POLL_INTERVAL_MS/);
  assert.doesNotMatch(source, /fetch\("\/api\/transcript-jobs\/sweep", \{ method: "POST" \}\)/);
  assert.doesNotMatch(source, /Gemini 生成字幕/);
  assert.doesNotMatch(source, /字幕生成中/);
});
