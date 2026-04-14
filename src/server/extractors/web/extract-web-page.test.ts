import assert from "node:assert/strict";
import test from "node:test";
import { RouteError } from "@/server/api/response";
import { extractWebPageFromHtml, extractWebPageMetadataFromHtml } from "@/server/extractors/web/extract-web-page";

const LONG_WECHAT_BODY =
  "这是一个正常的微信公众号正文段落，用来验证采集器仍然能够提取真实内容，而不是把中间壳页或者提示页误判成正文。".repeat(4);

test("rejects wechat share shell pages even when head metadata looks readable", () => {
  const rawHtml = `
    <html>
      <head>
        <title>分享页标题</title>
        <meta property="og:description" content="这里是完整文章摘要，但它只存在于 head 里，不能被当成可阅读正文。">
      </head>
      <body>
        <div id="js_article" class="share_content_page">
          <div class="share_media_swiper">
            <p>HarryHan 邓云瀚</p>
            <p>向上滑动看下一个</p>
            <p>微信扫一扫</p>
            <p>使用小程序</p>
            <p>微信扫一扫可打开此内容，使用完整服务</p>
          </div>
        </div>
        <div id="js_jump_wx_qrcode_dialog"></div>
      </body>
    </html>
  `;

  assert.throws(
    () =>
      extractWebPageFromHtml({
        requestUrl: "https://mp.weixin.qq.com/s/sBzRsu6YLMBACOr-BZshMg",
        rawHtml,
      }),
    (error) => error instanceof RouteError && error.code === "EXTRACTION_UNREADABLE",
  );
});

test("keeps normal wechat articles readable when content containers exist", () => {
  const rawHtml = `
    <html>
      <head>
        <meta property="og:title" content="正常微信文章">
      </head>
      <body>
        <div class="share_media_swiper"></div>
        <div id="img-content" class="rich_media_content">
          <h1 id="activity-name">正常微信文章</h1>
          <div id="js_content">
            <p>${LONG_WECHAT_BODY}</p>
            <p>${LONG_WECHAT_BODY}</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const result = extractWebPageFromHtml({
    requestUrl: "https://mp.weixin.qq.com/s/fs6QGr7FHSMEfi6_w5IPZQ",
    rawHtml,
  });

  assert.equal(result.title, "正常微信文章");
  assert.match(result.plainText, /正常的微信公众号正文段落/);
  assert.equal(result.contentHtml?.includes("<p>"), true);
});

test("extracts wechat publishedAt from publish_time text and script timestamp", () => {
  const rawHtml = `
    <html>
      <head>
        <meta property="og:title" content="带发布时间的微信文章">
      </head>
      <body>
        <div id="img-content" class="rich_media_content">
          <h1 id="activity-name">带发布时间的微信文章</h1>
          <em id="publish_time">2026年03月28日 08:15</em>
          <div id="js_content">
            <p>${LONG_WECHAT_BODY}</p>
            <p>${LONG_WECHAT_BODY}</p>
          </div>
        </div>
        <script>
          var ct = "1774666500";
        </script>
      </body>
    </html>
  `;

  const result = extractWebPageFromHtml({
    requestUrl: "https://mp.weixin.qq.com/s/wechat-time-demo",
    rawHtml,
  });

  assert.ok(result.publishedAt instanceof Date);
  assert.equal(result.publishedAt?.toISOString(), "2026-03-28T00:15:00.000Z");
});

test("extracts author from meta, json-ld and wechat byline", () => {
  const jsonLdRawHtml = `
    <html>
      <head>
        <meta property="og:title" content="作者提取测试">
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Article",
            "author": {
              "@type": "Person",
              "name": "Schema Author"
            }
          }
        </script>
      </head>
      <body>
        <article>
          <p>${LONG_WECHAT_BODY}</p>
          <p>${LONG_WECHAT_BODY}</p>
        </article>
      </body>
    </html>
  `;

  const metaRawHtml = `
    <html>
      <head>
        <meta name="author" content="Meta Author">
      </head>
      <body>
        <article>
          <p>${LONG_WECHAT_BODY}</p>
          <p>${LONG_WECHAT_BODY}</p>
        </article>
      </body>
    </html>
  `;

  const wechatBylineRawHtml = `
    <html>
      <head>
        <meta property="og:title" content="微信作者提取">
      </head>
      <body>
        <div id="img-content" class="rich_media_content">
          <div id="js_content">
            <section>文：王小明</section>
            <p>${LONG_WECHAT_BODY}</p>
            <p>${LONG_WECHAT_BODY}</p>
          </div>
        </div>
      </body>
    </html>
  `;

  const fromJsonLd = extractWebPageFromHtml({
    requestUrl: "https://example.com/author-jsonld",
    rawHtml: jsonLdRawHtml,
  });
  const fromMeta = extractWebPageFromHtml({
    requestUrl: "https://example.com/author-meta",
    rawHtml: metaRawHtml,
  });
  const fromWeChatByline = extractWebPageFromHtml({
    requestUrl: "https://mp.weixin.qq.com/s/author-byline-demo",
    rawHtml: wechatBylineRawHtml,
  });

  assert.equal(fromJsonLd.author, "Schema Author");
  assert.equal(fromMeta.author, "Meta Author");
  assert.equal(fromWeChatByline.author, "王小明");
});

test("does not treat top-level VideoObject name as article author", () => {
  const metadata = extractWebPageMetadataFromHtml({
    requestUrl: "https://youtu.be/video-author-demo",
    finalUrl: "https://www.youtube.com/watch?v=video-author-demo",
    rawHtml: `
      <html>
        <head>
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "VideoObject",
              "name": "Video Object Title",
              "uploadDate": "2026-04-01T00:00:00Z"
            }
          </script>
          <meta property="og:type" content="video.other">
          <meta property="og:title" content="Video Object Title">
          <meta property="og:description" content="Video description for metadata extraction.">
        </head>
        <body>
          <div id="player"></div>
        </body>
      </html>
    `,
  });

  assert.equal(metadata.author, null);
});

test("extracts wechat account name separately from the article author", () => {
  const rawHtml = `
    <html>
      <head>
        <meta property="og:title" content="微信账号与作者分离测试">
      </head>
      <body>
        <div id="img-content" class="rich_media_content">
          <span id="js_name">请辩</span>
          <div id="js_content">
            <section>文：蔡垒磊</section>
            <p>${LONG_WECHAT_BODY}</p>
            <p>${LONG_WECHAT_BODY}</p>
          </div>
        </div>
        <script>
          window.cgiData = {
            nick_name: JsDecode('请辩')
          };
        </script>
      </body>
    </html>
  `;

  const result = extractWebPageFromHtml({
    requestUrl: "https://mp.weixin.qq.com/s/account-author-split-demo",
    rawHtml,
  });

  assert.equal(result.author, "蔡垒磊");
  assert.equal(result.wechatAccountName, "请辩");
});

test("falls back to metadata text for video pages without readable article body", () => {
  const result = extractWebPageFromHtml({
    requestUrl: "https://youtu.be/video-fallback-demo",
    finalUrl: "https://www.youtube.com/watch?v=video-fallback-demo",
    rawHtml: `
      <html>
        <head>
          <title>Small Talk Video</title>
          <link rel="canonical" href="https://www.youtube.com/watch?v=video-fallback-demo">
          <meta property="og:type" content="video.other">
          <meta property="og:title" content="Small Talk Video">
          <meta
            property="og:description"
            content="This is a video entry and should still be imported with a readable fallback."
          >
        </head>
        <body>
          <div id="player"></div>
        </body>
      </html>
    `,
  });

  assert.equal(result.title, "Small Talk Video");
  assert.match(result.plainText, /video entry and should still be imported/i);
  assert.match(result.plainText, /Video URL: https:\/\/www\.youtube\.com\/watch\?v=video-fallback-demo/);
  assert.ok(result.wordCount > 0);
  assert.equal(result.contentHtml?.includes("<p>"), true);
});

test("rejects low-signal wechat output even if extraction produced some text", () => {
  const rawHtml = `
    <html>
      <head>
        <title>壳页噪音</title>
      </head>
      <body>
        <div class="page-shell">
          <p>HarryHan 邓云瀚</p>
          <p>向上滑动看下一个</p>
          <p>微信扫一扫</p>
          <p>使用小程序</p>
          <p>微信扫一扫可打开此内容，使用完整服务</p>
        </div>
      </body>
    </html>
  `;

  assert.throws(
    () =>
      extractWebPageFromHtml({
        requestUrl: "https://mp.weixin.qq.com/s/sBzRsu6YLMBACOr-BZshMg",
        rawHtml,
      }),
    (error) => error instanceof RouteError && error.code === "EXTRACTION_UNREADABLE",
  );
});

test("rejects wechat migration pages as unreadable content", () => {
  const rawHtml = `
    <html>
      <head>
        <title>账号已迁移</title>
      </head>
      <body>
        <div class="migration-page">
          <h1>该公众号已迁移</h1>
          <p>该公众号已迁移至新的账号，原账号已回收。</p>
          <p>若需访问原文章链接，请点击下方按钮。</p>
          <a href="https://mp.weixin.qq.com/">访问原文章</a>
        </div>
      </body>
    </html>
  `;

  assert.throws(
    () =>
      extractWebPageFromHtml({
        requestUrl: "https://mp.weixin.qq.com/s/51iYLcQwh7r31UN3jSkcPQ",
        rawHtml,
      }),
    (error) => error instanceof RouteError && error.code === "EXTRACTION_UNREADABLE",
  );
});

test("extracts WeChat metadata hints from verification pages", () => {
  const result = extractWebPageMetadataFromHtml({
    requestUrl:
      "https://mp.weixin.qq.com/mp/wappoc_appmsgcaptcha?poc_token=example&target_url=https%3A%2F%2Fmp.weixin.qq.com%2Fs%2Ftarget-demo",
    finalUrl:
      "https://mp.weixin.qq.com/mp/wappoc_appmsgcaptcha?poc_token=example&target_url=https%3A%2F%2Fmp.weixin.qq.com%2Fs%2Ftarget-demo",
    rawHtml: `
      <html>
        <head>
          <title>当前环境异常</title>
        </head>
        <body>
          <p>当前环境异常</p>
          <p>完成验证后即可继续访问</p>
          <p>去验证</p>
        </body>
      </html>
    `,
  });

  assert.equal(result.wechatPageKind, "verification");
  assert.equal(result.wechatTargetUrl, "https://mp.weixin.qq.com/s/target-demo");
});

test("extracts WeChat metadata hints from migration pages with a target article link", () => {
  const result = extractWebPageMetadataFromHtml({
    requestUrl: "https://mp.weixin.qq.com/s/51iYLcQwh7r31UN3jSkcPQ",
    finalUrl: "https://mp.weixin.qq.com/s/51iYLcQwh7r31UN3jSkcPQ",
    rawHtml: `
      <html>
        <head>
          <title>账号已迁移</title>
        </head>
        <body>
          <div class="migration-page">
            <h1>该公众号已迁移</h1>
            <p>该公众号已迁移至新的账号，原账号已回收。</p>
            <p>若需访问原文章链接，请点击下方按钮。</p>
            <a href="https://mp.weixin.qq.com/s/migrated-target-demo">访问原文章</a>
          </div>
        </body>
      </html>
    `,
  });

  assert.equal(result.wechatPageKind, "migration");
  assert.equal(result.wechatTargetUrl, "https://mp.weixin.qq.com/s/migrated-target-demo");
});
