import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { RouteError } from "@/server/api/response";
import { extractWebPageFromHtml } from "@/server/extractors/web/extract-web-page";

function readFixture(name: string) {
  return readFileSync(new URL(`../fixtures/wechat/${name}`, import.meta.url), "utf8");
}

test("extracts a readable WeChat article and trims trailing promo blocks", () => {
  const result = extractWebPageFromHtml({
    requestUrl: "https://mp.weixin.qq.com/s/fs6QGr7FHSMEfi6_w5IPZQ",
    finalUrl: "https://mp.weixin.qq.com/s/fs6QGr7FHSMEfi6_w5IPZQ",
    rawHtml: readFixture("article.html"),
  });

  assert.equal(result.title, "一人IP公司的诅咒");
  assert.ok(result.contentHtml);
  assert.ok(result.plainText.length > 120);
  assert.ok(result.wordCount > 120);
  assert.match(result.plainText, /一人IP公司/);
  assert.doesNotMatch(result.plainText, /Tips:|交流群|aidog\.xyz|感谢你的阅读/);
  assert.doesNotMatch(result.contentHtml ?? "", /Tips:|aidog\.xyz|感谢你的阅读/);
});

test("rejects WeChat share shell pages even when metadata looks like a real article", () => {
  assert.throws(
    () =>
      extractWebPageFromHtml({
        requestUrl: "https://mp.weixin.qq.com/s/sBzRsu6YLMBACOr-BZshMg",
        finalUrl: "https://mp.weixin.qq.com/s/sBzRsu6YLMBACOr-BZshMg",
        rawHtml: readFixture("share-shell.html"),
      }),
    (error) => {
      assert.ok(error instanceof RouteError);
      assert.equal(error.code, "EXTRACTION_UNREADABLE");
      return true;
    },
  );
});

test("rejects WeChat migration pages as unreadable", () => {
  assert.throws(
    () =>
      extractWebPageFromHtml({
        requestUrl: "https://mp.weixin.qq.com/s/51iYLcQwh7r31UN3jSkcPQ",
        finalUrl: "https://mp.weixin.qq.com/s/51iYLcQwh7r31UN3jSkcPQ",
        rawHtml: readFixture("migration.html"),
      }),
    (error) => {
      assert.ok(error instanceof RouteError);
      assert.equal(error.code, "EXTRACTION_UNREADABLE");
      return true;
    },
  );
});

test("rejects WeChat verification pages before extraction", () => {
  assert.throws(
    () =>
      extractWebPageFromHtml({
        requestUrl:
          "https://mp.weixin.qq.com/mp/wappoc_appmsgcaptcha?poc_token=example&target_url=https%3A%2F%2Fmp.weixin.qq.com%2Fs%2Fexample",
        finalUrl:
          "https://mp.weixin.qq.com/mp/wappoc_appmsgcaptcha?poc_token=example&target_url=https%3A%2F%2Fmp.weixin.qq.com%2Fs%2Fexample",
        rawHtml: readFixture("verification.html"),
      }),
    (error) => {
      assert.ok(error instanceof RouteError);
      assert.equal(error.code, "SOURCE_VERIFICATION_REQUIRED");
      return true;
    },
  );
});
