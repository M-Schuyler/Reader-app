import assert from "node:assert/strict";
import test from "node:test";
import { extractWebPageFromHtml } from "@/server/extractors/web/extract-web-page";

test("extractor preserves key semantic tags for structured article content", () => {
  const rawHtml = `
    <html>
      <head>
        <title>结构化格式保真</title>
      </head>
      <body>
        <main class="article-body">
          <article>
            <h1>结构化格式保真</h1>
            <p>段落里包含上标 x<sup>2</sup>、下标 H<sub>2</sub>O、<u>下划线</u> 与 <del>删除线</del>。</p>
            <table class="data-table">
              <caption>季度汇总</caption>
              <thead>
                <tr>
                  <th scope="col">季度</th>
                  <th scope="col">增长</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Q1</td>
                  <td>12%</td>
                </tr>
                <tr>
                  <td>Q2</td>
                  <td>15%</td>
                </tr>
              </tbody>
            </table>
            <p>收尾正文，确保文本长度达标且不是噪声内容。</p>
          </article>
        </main>
      </body>
    </html>
  `;

  const result = extractWebPageFromHtml({
    requestUrl: "https://example.com/format-fidelity",
    finalUrl: "https://example.com/format-fidelity",
    rawHtml,
  });

  const contentHtml = result.contentHtml ?? "";
  assert.match(contentHtml, /<table/);
  assert.match(contentHtml, /<thead>/);
  assert.match(contentHtml, /<tbody>/);
  assert.match(contentHtml, /<caption>/);
  assert.match(contentHtml, /<sup>/);
  assert.match(contentHtml, /<sub>/);
  assert.match(contentHtml, /<u>/);
  assert.match(contentHtml, /<del>/);
  assert.match(result.plainText, /季度汇总/);
  assert.match(result.plainText, /Q1/);
  assert.match(result.plainText, /H\s*2\s*O/);
});

test("extractor keeps short lead-in text when it is content instead of boilerplate", () => {
  const rawHtml = `
    <html>
      <head>
        <title>短句保留</title>
      </head>
      <body>
        <article class="entry-content">
          <p>导语：这不是广告，而是正文线索。</p>
          <p>这里继续展开正文，包含充分信息来保证抽取后的阅读可用性与完整性。</p>
        </article>
      </body>
    </html>
  `;

  const result = extractWebPageFromHtml({
    requestUrl: "https://example.com/lead-in",
    rawHtml,
  });

  assert.match(result.plainText, /导语：这不是广告，而是正文线索。/);
  assert.match(result.contentHtml ?? "", /导语：这不是广告，而是正文线索。/);
});

test("format fidelity score reaches at least 95 for structured fixture", () => {
  const rawHtml = `
    <html>
      <head>
        <title>结构化格式评分</title>
      </head>
      <body>
        <main class="article-body">
          <article>
            <h1>结构化格式评分</h1>
            <p>这是正文开头，介绍数据背景。</p>
            <p>数学符号 x<sup>2</sup> 与 H<sub>2</sub>O，<u>强调信息</u>，以及 <del>删除语义</del>。</p>
            <table>
              <caption>统计表</caption>
              <thead>
                <tr>
                  <th>项</th>
                  <th>值</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>A</td>
                  <td>42</td>
                </tr>
              </tbody>
            </table>
            <blockquote>引用段落用于验证结构保真。</blockquote>
            <p>结尾段落，完整收束内容。</p>
          </article>
        </main>
      </body>
    </html>
  `;

  const result = extractWebPageFromHtml({
    requestUrl: "https://example.com/format-score",
    finalUrl: "https://example.com/format-score",
    rawHtml,
  });

  const html = result.contentHtml ?? "";
  const containsAllStructuralTags = ["table", "thead", "tbody", "tr", "th", "td", "blockquote", "caption"].every((tag) =>
    new RegExp(`<${tag}\\b`).test(html),
  );
  const containsAllInlineSemantics = ["sup", "sub", "u", "del"].every((tag) => new RegExp(`<${tag}\\b`).test(html));
  const noPromoNoise = !/相关阅读|推荐阅读|猜你喜欢|相关推荐|share this|related articles/i.test(result.plainText);
  const readableEnough = result.plainText.length >= 90 && result.wordCount >= 50;

  const score =
    (containsAllStructuralTags ? 40 : 0) +
    (containsAllInlineSemantics ? 20 : 0) +
    (noPromoNoise ? 20 : 0) +
    (readableEnough ? 20 : 0);

  assert.ok(score >= 95, `format fidelity score too low: ${score}`);
});
