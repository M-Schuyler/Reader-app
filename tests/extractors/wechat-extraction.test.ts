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
  assert.equal(result.author, "蔡垒磊");
  assert.ok(result.contentHtml);
  assert.ok(result.plainText.length > 120);
  assert.ok(result.wordCount > 120);
  assert.match(result.plainText, /一人IP公司/);
  assert.doesNotMatch(result.plainText, /Tips:|交流群|aidog\.xyz|感谢你的阅读/);
  assert.doesNotMatch(result.contentHtml ?? "", /Tips:|aidog\.xyz|感谢你的阅读/);
});

test("extracts WeChat text-share pages when readable content only exists in inline script payload", () => {
  const rawHtml = `
    <!DOCTYPE html>
    <html lang="zh-CN">
      <head>
        <meta charset="utf-8" />
        <meta property="og:title" content="成功人士的话，该不该听？" />
        <title></title>
      </head>
      <body>
        <div id="js_article"></div>
        <div id="stream_article_bottom_area"></div>
        <div id="wx_expand_slidetip">
          <span>向上滑动看下一个</span>
        </div>
        <span id="js_name">data-miniprogram-nickname</span>
        <div id="js_jump_wx_qrcode_dialog">
          <p>微信扫一扫可打开此内容，使用完整服务</p>
        </div>
        <div class="author">data-miniprogram-nickname</div>
        <script>
          (function () {
            function JsDecode(str) {
              return str
                .replace(/\\\\x0a/g, "\\n")
                .replace(/\\\\x27/g, "'");
            }

            const miniProgramAttrMap = {
              nickname: "data-miniprogram-nickname"
            };
            window.item_show_type = '10';
            window.ct = '1775539046';
            window.cgiDataNew = {
              nick_name: JsDecode('请辩'),
              title: JsDecode('成功人士的话，该不该听？'),
              content_noencode: JsDecode(
                '今天无意中刷到了雷军的一次讲话，他说不要羡慕学神，也不要羡慕进入了什么学校。\\\\x0a\\\\x0a雷军说得对不对？是对的，但评论区都是说他讲鸡汤。\\\\x0a\\\\x0a是，大家来听讲座真的因为他是雷军，而不是因为他说的话。\\\\x0a\\\\x0a这是个权重问题，成功人士在自己的成功领域里发表的内容，天然就应该有更高的采信权重。'
              ),
              source_url: ''
            };
          })();
        </script>
      </body>
    </html>
  `;

  const result = extractWebPageFromHtml({
    requestUrl: "https://mp.weixin.qq.com/s/u5b-5ihEDEIFvykN_HDZig",
    finalUrl: "https://mp.weixin.qq.com/s/u5b-5ihEDEIFvykN_HDZig",
    rawHtml,
  });

  assert.equal(result.title, "成功人士的话，该不该听？");
  assert.equal(result.author, "请辩");
  assert.ok(result.publishedAt instanceof Date);
  assert.equal(result.publishedAt?.toISOString(), "2026-04-07T05:17:26.000Z");
  assert.ok(result.contentHtml);
  assert.match(result.plainText, /成功人士在自己的成功领域里发表的内容/);
  assert.doesNotMatch(result.plainText, /微信扫一扫|向上滑动看下一个/);
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
