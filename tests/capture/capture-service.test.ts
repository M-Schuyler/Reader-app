import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  deriveContentOriginMetadata,
  syncWechatSubsourceFromContentOrigin,
} from "@/lib/documents/content-origin";
import { RouteError } from "@/server/api/response";
import { normalizeCaptureInputUrl } from "@/server/modules/capture/capture.service";

function readWorkspaceFile(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("normalizeCaptureInputUrl trims input and strips hash", () => {
  const normalized = normalizeCaptureInputUrl("  https://example.com/article#section  ");
  assert.equal(normalized, "https://example.com/article");
});

test("normalizeCaptureInputUrl rejects empty and non-absolute urls", () => {
  assert.throws(
    () => normalizeCaptureInputUrl("   "),
    (error) => error instanceof RouteError && error.code === "INVALID_URL",
  );

  assert.throws(
    () => normalizeCaptureInputUrl("/relative/path"),
    (error) => error instanceof RouteError && error.code === "INVALID_URL",
  );
});

test("normalizeCaptureInputUrl rejects non-http protocols", () => {
  assert.throws(
    () => normalizeCaptureInputUrl("javascript:alert(1)"),
    (error) => error instanceof RouteError && error.code === "INVALID_URL",
  );
});

test("deriveContentOriginMetadata prefers an explicit WeChat account name over raw HTML nickname", () => {
  const result = deriveContentOriginMetadata({
    canonicalUrl: "https://mp.weixin.qq.com/s?__biz=MzI0MDg5ODA2NQ==&mid=1&idx=1&sn=abc",
    finalUrl: "https://mp.weixin.qq.com/s?__biz=MzI0MDg5ODA2NQ==&mid=1&idx=1&sn=abc",
    rawHtml: "<script>var profile_nickname = \"旧昵称\";</script>",
    sourceUrl: "https://mp.weixin.qq.com/s/u5b-5ihEDEIFvykN_HDZig",
    wechatAccountName: "请辩",
  });

  assert.equal(result.label, "请辩");
});

test("syncWechatSubsourceFromContentOrigin only writes biz-backed WeChat rows and uses the explicit account name when present", async () => {
  const origin = deriveContentOriginMetadata({
    canonicalUrl: "https://mp.weixin.qq.com/s?__biz=MzI0MDg5ODA2NQ==&mid=1&idx=1&sn=abc",
    finalUrl: "https://mp.weixin.qq.com/s?__biz=MzI0MDg5ODA2NQ==&mid=1&idx=1&sn=abc",
    rawHtml: "<script>var profile_nickname = \"旧昵称\";</script>",
    sourceUrl: "https://mp.weixin.qq.com/s/u5b-5ihEDEIFvykN_HDZig",
    wechatAccountName: "请辩",
  });

  const calls: Array<{ biz: string; displayName: string | null }> = [];

  await syncWechatSubsourceFromContentOrigin(
    origin,
    { wechatAccountName: "请辩" },
    async (input) => {
      calls.push(input);
      return input;
    },
  );

  await syncWechatSubsourceFromContentOrigin(
    {
      isWechat: true,
      key: "wechat:nickname:请辩",
      label: "请辩",
    },
    { wechatAccountName: "请辩" },
    async (input) => {
      calls.push(input);
      return input;
    },
  );

  await syncWechatSubsourceFromContentOrigin(
    {
      isWechat: false,
      key: null,
      label: null,
    },
    { wechatAccountName: "请辩" },
    async (input) => {
      calls.push(input);
      return input;
    },
  );

  assert.deepEqual(calls, [
    {
      biz: "MzI0MDg5ODA2NQ==",
      displayName: "请辩",
    },
  ]);
});

test("new video captures persist transcript status and source when creating a document", () => {
  const source = readWorkspaceFile("src/server/modules/capture/capture.service.ts");
  const createPathStart = source.indexOf("const videoDocument = await createWebDocument({");
  const createPathEnd = source.indexOf("const sourceHostname =", createPathStart);

  assert.notEqual(createPathStart, -1);
  assert.notEqual(createPathEnd, -1);

  const createPath = source.slice(createPathStart, createPathEnd);

  assert.match(createPath, /transcriptSegments: capturedVideo\.transcriptSegments,/);
  assert.match(createPath, /transcriptSource: capturedVideo\.transcriptSource,/);
  assert.match(createPath, /transcriptStatus: capturedVideo\.transcriptStatus,/);
});
