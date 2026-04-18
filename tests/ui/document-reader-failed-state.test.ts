import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolveDocumentFailedState } from "@/lib/documents/document-failed-state";

function readWorkspaceFile(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("document failed state explains verification-gated WeChat pages in product language", () => {
  assert.deepEqual(
    resolveDocumentFailedState({
      code: "SOURCE_VERIFICATION_REQUIRED",
      message: "来源站点触发验证或环境异常，当前无法稳定抓取正文。",
    }),
    {
      title: "这篇文章需要先过来源验证",
      description: "Reader 已经帮你保存了链接，但当前访问环境下，来源站点没有把正文稳定地返回给我们。",
      nextStep: "你可以先打开原文确认内容仍然可访问，换个时间再重新导入。",
    },
  );
});

test("document failed state explains subtitle-unavailable video imports", () => {
  assert.deepEqual(
    resolveDocumentFailedState({
      code: "VIDEO_SUBTITLE_UNAVAILABLE",
      message: "该视频暂时没有可用字幕，无法导入。",
    }),
    {
      title: "这条视频当前没有可用字幕",
      description: "Reader 依赖字幕来生成可阅读正文；这次没有拿到可用字幕轨道，所以暂时无法导入为视频阅读内容。",
      nextStep: "你可以先打开原视频确认是否提供字幕，或换一条有字幕的视频链接再导入。",
    },
  );
});

test("document reader uses the failed-state resolver instead of hard-coded generic failure copy", () => {
  const reader = readWorkspaceFile("src/components/reader/document-reader.tsx");

  assert.match(reader, /resolveDocumentFailedState/);
  assert.match(reader, /failedState\.title/);
  assert.match(reader, /failedState\.description/);
  assert.match(reader, /failedState\.nextStep/);
});

test("document reader renders source attribution under the title and in metadata", () => {
  const reader = readWorkspaceFile("src/components/reader/document-reader.tsx");

  assert.match(reader, /document\.contentOrigin/);
  assert.match(reader, /documentAttribution\.value/);
});

test("document reader renders embedded videos for supported document links", () => {
  const reader = readWorkspaceFile("src/components/reader/document-reader.tsx");

  assert.match(reader, /const videoEmbed = readerDocument\.videoEmbed/);
  assert.match(reader, /const isVideoMode = Boolean\(videoEmbed\)/);
  assert.match(reader, /const isReadable = isVideoMode \|\| \(!isFailed && hasExtractedContent\)/);
  assert.match(reader, /const canHighlight = isReadable && !isVideoMode/);
  assert.match(reader, /<VideoReader/);
  assert.match(reader, /videoDurationSeconds=\{readerDocument\.videoDurationSeconds\}/);
  assert.match(reader, /\{videoEmbed \? \(/);
  assert.match(reader, /\) : isFailed \? \(/);
});

test("video documents use a compact header and tighter reader surface spacing", () => {
  const reader = readWorkspaceFile("src/components/reader/document-reader.tsx");

  assert.match(reader, /const readerHeaderClassName = cx\(/);
  assert.match(reader, /isVideoMode \? "space-y-4 lg:space-y-5" : "space-y-6"/);
  assert.match(reader, /const readerTitleClassName = cx\(/);
  assert.match(reader, /font-ui-heading text-\[2rem\] leading-\[1\.02\] tracking-\[-0\.04em\] sm:text-\[2\.75rem\]/);
  assert.match(reader, /const readerSurfaceBodyClassName = cx\(/);
  assert.match(reader, /isVideoMode \? "px-5 py-6 sm:px-7 sm:py-7" : "px-7 py-9 sm:px-11 sm:py-11"/);
});
