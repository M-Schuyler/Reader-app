import assert from "node:assert/strict";
import test from "node:test";
import { PublishedAtKind } from "@prisma/client";
import { RouteError } from "@/server/api/response";
import {
  buildImportedCuboxDocument,
  buildCuboxHighlightQuoteText,
  normalizeCuboxImportLimit,
  normalizeCuboxSourceUrl,
  parseCuboxApiLink,
  renderCuboxMarkdownToDocumentContent,
  resolveCuboxExcerpt,
  resolveCuboxDocumentTimestamps,
  resolveCuboxDocumentTitle,
} from "@/server/modules/imports/cubox";

test("parseCuboxApiLink accepts cubox.pro and cubox.cc api links", () => {
  assert.deepEqual(parseCuboxApiLink("https://cubox.pro/c/api/save/abc123"), {
    domain: "cubox.pro",
    token: "abc123",
  });

  assert.deepEqual(parseCuboxApiLink("https://cubox.cc/c/api/save/xyz789"), {
    domain: "cubox.cc",
    token: "xyz789",
  });
});

test("parseCuboxApiLink rejects invalid domains and malformed paths", () => {
  assert.throws(
    () => parseCuboxApiLink("https://example.com/c/api/save/nope"),
    (error) => error instanceof RouteError && error.code === "INVALID_CUBOX_API_LINK",
  );

  assert.throws(
    () => parseCuboxApiLink("https://cubox.pro/not-api/nope"),
    (error) => error instanceof RouteError && error.code === "INVALID_CUBOX_API_LINK",
  );

  assert.throws(
    () => parseCuboxApiLink("https://cubox.pro/c/api/save/"),
    (error) => error instanceof RouteError && error.code === "INVALID_CUBOX_API_LINK",
  );
});

test("normalizeCuboxImportLimit defaults to 20 and caps oversized values", () => {
  assert.equal(normalizeCuboxImportLimit(undefined), 20);
  assert.equal(normalizeCuboxImportLimit(5), 5);
  assert.equal(normalizeCuboxImportLimit(99), 20);
});

test("normalizeCuboxSourceUrl keeps only safe absolute http urls", () => {
  assert.equal(normalizeCuboxSourceUrl("https://example.com/article#top"), "https://example.com/article");
  assert.equal(normalizeCuboxSourceUrl("http://example.com/path"), "http://example.com/path");
  assert.equal(normalizeCuboxSourceUrl(""), null);
  assert.equal(normalizeCuboxSourceUrl("cubox://internal"), null);
});

test("renderCuboxMarkdownToDocumentContent keeps lightweight structure and plain text", () => {
  const rendered = renderCuboxMarkdownToDocumentContent(`# Heading

**Bold** text with [a link](https://example.com/path).

- First item
- Second item

![](https://example.com/image.png)`);

  assert.match(rendered.contentHtml, /<h1>Heading<\/h1>/);
  assert.match(rendered.contentHtml, /<strong>Bold<\/strong>/);
  assert.match(rendered.contentHtml, /<a href="https:\/\/example\.com\/path"/);
  assert.match(rendered.contentHtml, /<li>First item<\/li>/);
  assert.match(rendered.contentHtml, /<img src="https:\/\/example\.com\/image\.png"/);
  assert.match(rendered.plainText, /Heading/);
  assert.match(rendered.plainText, /Bold text with a link/);
  assert.match(rendered.plainText, /First item/);
});

test("renderCuboxMarkdownToDocumentContent preserves Cubox proxy images without polluting excerpt text", () => {
  const rendered = renderCuboxMarkdownToDocumentContent(`![](https://cubox.pro/c/filters:no_upscale()?imageUrl=https%3A%2F%2Fexample.com%2Fhero.png)

文：蔡垒磊

随着前几天深圳开始建立房票制度，一线城市基本已经确认都在这条路上了。再加上一些二线城市的跟进，趋势已经很明了。`);

  assert.match(rendered.contentHtml, /<img src="https:\/\/cubox\.pro\/c\/filters:no_upscale\(\)\?imageUrl=https%3A%2F%2Fexample\.com%2Fhero\.png"/);
  assert.doesNotMatch(rendered.plainText, /filters:no_upscale/);
  assert.equal(rendered.excerpt, "随着前几天深圳开始建立房票制度，一线城市基本已经确认都在这条路上了。再加上一些二线城市的跟进，趋势已经很明了。");
});

test("resolveCuboxExcerpt prefers a meaningful body excerpt over a terse Cubox description", () => {
  assert.equal(
    resolveCuboxExcerpt("可你毫无办法。", "随着前几天深圳开始建立房票制度，一线城市基本已经确认都在这条路上了。"),
    "随着前几天深圳开始建立房票制度，一线城市基本已经确认都在这条路上了。",
  );

  assert.equal(resolveCuboxExcerpt("这是 memo 摘要。", null), "这是 memo 摘要。");
});

test("resolveCuboxDocumentTitle falls back to the first non-empty content line", () => {
  assert.equal(
    resolveCuboxDocumentTitle(
      {
        title: "",
        article_title: "",
      },
      "  \nFirst useful line\nSecond line",
    ),
    "First useful line",
  );
});

test("buildCuboxHighlightQuoteText falls back to an image placeholder", () => {
  assert.equal(
    buildCuboxHighlightQuoteText({
      text: "",
      image_url: "https://example.com/highlight.png",
    }),
    "[Image highlight] https://example.com/highlight.png",
  );
});

test("resolveCuboxDocumentTimestamps keeps Cubox history out of Reader document timeline", () => {
  const importedAt = new Date("2026-04-06T09:30:00.000Z");
  const timestamps = resolveCuboxDocumentTimestamps(
    {
      create_time: "2025-03-22T16:02:44.979+0800",
      update_time: "2025-03-23T08:15:01.000+0800",
    },
    importedAt,
  );

  assert.equal(timestamps.createdAt.toISOString(), importedAt.toISOString());
  assert.equal(timestamps.updatedAt.toISOString(), importedAt.toISOString());
});

test("buildImportedCuboxDocument prefers source-page publishedAt while keeping Reader import recency", () => {
  const importedAt = new Date("2026-04-07T02:30:00.000Z");
  const publishedAt = new Date("2025-03-28T00:15:00.000Z");

  const importedDocument = buildImportedCuboxDocument(
    {
      id: "card-1",
      title: "房票就是抢钱",
      article_title: "房票就是抢钱",
      description: "可你毫无办法。",
      url: "https://mp.weixin.qq.com/s/wechat-time-demo",
      create_time: "2025-03-22T16:02:44.979+0800",
      update_time: "2025-03-23T08:15:01.000+0800",
      tags: [],
      highlights: [],
    },
    "随着前几天深圳开始建立房票制度，一线城市基本已经确认都在这条路上了。",
    [],
    importedAt,
    {
      publishedAt,
    },
  );

  assert.equal(importedDocument.createdAt.toISOString(), importedAt.toISOString());
  assert.equal(importedDocument.updatedAt.toISOString(), importedAt.toISOString());
  assert.equal(importedDocument.publishedAt?.toISOString(), publishedAt.toISOString());
  assert.equal(importedDocument.publishedAtKind, PublishedAtKind.EXACT);
});
