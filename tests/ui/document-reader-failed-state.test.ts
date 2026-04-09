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

test("document reader uses the failed-state resolver instead of hard-coded generic failure copy", () => {
  const reader = readWorkspaceFile("src/components/reader/document-reader.tsx");

  assert.match(reader, /resolveDocumentFailedState/);
  assert.match(reader, /failedState\.title/);
  assert.match(reader, /failedState\.description/);
  assert.match(reader, /failedState\.nextStep/);
});
