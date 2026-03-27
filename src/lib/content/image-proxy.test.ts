import assert from "node:assert/strict";
import test from "node:test";
import {
  buildImageProxyUrl,
  parseImageProxyTarget,
  resolveReaderImageUrl,
} from "@/lib/content/image-proxy";

test("proxies wechat article images through the local image proxy route", () => {
  const sourceUrl = "https://mp.weixin.qq.com/s/fs6QGr7FHSMEfi6_w5IPZQ";
  const imageUrl =
    "https://mmbiz.qpic.cn/sz_mmbiz_png/1B46O58DzC5NoX9RJx3utFunTtZznMztINgzsWOhsCdCWpAplQwj2raURowgEpVqgufDD08gy5Eib2dOuJD3orvNVAiafT2GNqrjYhVNYgWC4/640?wx_fmt=png";

  assert.equal(resolveReaderImageUrl(imageUrl, sourceUrl), buildImageProxyUrl(imageUrl));
});

test("keeps non-wechat images as direct absolute URLs", () => {
  const sourceUrl = "https://developer.mozilla.org/en-US/docs/Web/HTTP/Overview";
  const imageUrl = "/static/example.png";

  assert.equal(resolveReaderImageUrl(imageUrl, sourceUrl), "https://developer.mozilla.org/static/example.png");
});

test("accepts only whitelisted wechat image hosts for proxying", () => {
  const allowedImageUrl =
    "https://mmbiz.qpic.cn/sz_mmbiz_png/1B46O58DzC5NoX9RJx3utFunTtZznMztINgzsWOhsCdCWpAplQwj2raURowgEpVqgufDD08gy5Eib2dOuJD3orvNVAiafT2GNqrjYhVNYgWC4/640?wx_fmt=png";

  assert.equal(parseImageProxyTarget(allowedImageUrl), allowedImageUrl);
  assert.equal(parseImageProxyTarget("https://example.com/image.png"), null);
  assert.equal(parseImageProxyTarget("javascript:alert(1)"), null);
});
