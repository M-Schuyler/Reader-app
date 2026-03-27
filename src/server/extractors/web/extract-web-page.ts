import { createHash } from "node:crypto";
import { load, type Cheerio, type CheerioAPI } from "cheerio";
import type { AnyNode, Element } from "domhandler";
import { RouteError } from "@/server/api/response";

const CONTENT_PREFERRED_SELECTORS = [
  "#img-content",
  "#js_content",
  "article",
  "main article",
  "[role='main'] article",
  "main",
  "[role='main']",
  ".article-content",
  ".article-body",
  ".post-content",
  ".entry-content",
  ".post-body",
  ".content-body",
  ".story-body",
  ".markdown-body",
  ".rich-text",
  ".richtext",
  ".doc-content",
  ".detail-content",
];

const CONTENT_POSITIVE_KEYWORDS = /article|content|entry|post|story|detail|body|text|markdown|rich/i;
const CONTENT_NEGATIVE_KEYWORDS =
  /nav|menu|footer|header|sidebar|share|social|related|recommend|comment|breadcrumb|subscribe|newsletter|advert|ads|promo|cookie|modal|popup|pager|pagination|toolbar|hero/i;
const BOILERPLATE_TEXT_PATTERNS =
  /相关阅读|推荐阅读|猜你喜欢|相关推荐|分享|扫码|打开微信|上一篇|下一篇|责任编辑|版权所有|声明：|广告|赞助|related articles|read more|share this|all rights reserved|cookie/i;
const VERIFICATION_PAGE_PATTERNS =
  /verify you are human|security check|enable javascript and cookies|checking if the site connection is secure|captcha|安全验证|请完成验证|当前环境异常|完成验证后即可继续访问/i;
const SHELL_PAGE_PATTERNS =
  /access denied|403 forbidden|404 not found|page not found|temporarily unavailable|service unavailable|redirecting|正在跳转|请先登录|login required|sign in to continue/i;
const LEADING_META_TEXT_PATTERNS = /^(原创|作者|来源|编辑|文[:：]|by\s|发表于|阅读原文|在.+阅读$)/i;
const WECHAT_NOISE_SELECTORS = [
  "#meta_content",
  "#js_tags",
  "#js_profile_qrcode",
  "#js_pc_qr_code_img",
  ".rich_media_meta_list",
  ".rich_media_meta",
  ".rich_media_tool",
  ".rich_media_extra",
  ".rich_media_area_extra",
  ".wx_profile_msg_inner",
  ".original_primary_card_tips",
  ".reward_area",
  ".qr_code_pc_outer",
  ".js_reprinted_source",
];
const ALLOWED_TAGS = new Set([
  "article",
  "section",
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "blockquote",
  "pre",
  "code",
  "figure",
  "figcaption",
  "img",
  "a",
  "strong",
  "b",
  "em",
  "i",
  "br",
  "hr",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
]);

export type ExtractedWebPage = {
  finalUrl: string;
  canonicalUrl: string | null;
  title: string;
  lang: string | null;
  author: string | null;
  publishedAt: Date | null;
  excerpt: string;
  contentHtml: string | null;
  plainText: string;
  rawHtml: string;
  wordCount: number;
  textHash: string;
};

export async function extractWebPage(url: string): Promise<ExtractedWebPage> {
  const requestUrl = new URL(url);
  const response = await fetch(url, {
    method: "GET",
    redirect: "follow",
    cache: "no-store",
    headers: buildRequestHeaders(requestUrl),
  });

  if (!response.ok) {
    throw new RouteError("FETCH_FAILED", 502, `Failed to fetch "${url}".`);
  }

  const rawHtml = await response.text();
  const finalUrl = response.url || url;
  assertPageIsReadable(requestUrl, finalUrl, rawHtml);

  const $ = load(rawHtml);
  const title = extractTitle($, finalUrl) ?? new URL(finalUrl).hostname;
  const lang = extractLang($);
  const canonicalUrl = extractCanonicalUrl($, finalUrl);
  const author = extractAuthor($);
  const contentHtml = trimReadableHtml(extractReadableHtml($, finalUrl), title);
  const plainText = htmlToPlainText(contentHtml);

  if (!plainText) {
    throw new RouteError("EXTRACTION_EMPTY", 422, "The page was fetched but no readable text was extracted.");
  }

  const excerpt = plainText.slice(0, 240);
  const wordCount = plainText.split(/\s+/).filter(Boolean).length;
  const textHash = createHash("sha256").update(plainText).digest("hex");

  return {
    finalUrl,
    canonicalUrl,
    title,
    lang,
    author,
    publishedAt: null,
    excerpt,
    contentHtml: contentHtml || null,
    plainText,
    rawHtml,
    wordCount,
    textHash,
  };
}

function buildRequestHeaders(url: URL): Record<string, string> {
  if (isWeChatHost(url)) {
    return {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
      "cache-control": "no-cache",
      pragma: "no-cache",
    };
  }

  return {
    "user-agent": "reader-app/0.1",
  };
}

function assertPageIsReadable(requestUrl: URL, finalUrl: string, rawHtml: string) {
  const finalPageUrl = safeParseUrl(finalUrl);

  if (isWeChatVerificationPage(requestUrl, finalPageUrl, rawHtml)) {
    throw new RouteError(
      "SOURCE_VERIFICATION_REQUIRED",
      422,
      "来源站点触发验证或环境异常，当前无法稳定抓取正文。",
    );
  }

  const pageText = htmlToPlainText(rawHtml).slice(0, 1_500);
  if (VERIFICATION_PAGE_PATTERNS.test(pageText) && pageText.length < 800) {
    throw new RouteError("SOURCE_VERIFICATION_REQUIRED", 422, "来源站点要求验证，当前无法稳定抓取正文。");
  }

  if (SHELL_PAGE_PATTERNS.test(pageText) && pageText.length < 600) {
    throw new RouteError("EXTRACTION_UNREADABLE", 422, "来源站点返回了异常或壳页面，无法提取可阅读正文。");
  }
}

function extractReadableHtml($: CheerioAPI, finalUrl: string) {
  const $candidate = selectContentRoot($);
  const candidateHtml = getTagName($candidate) === "body" ? ($candidate.html() ?? "") : ($.html($candidate) ?? "");
  const $content = load(`<body>${candidateHtml}</body>`);
  const $root = $content("body");

  removeCommentNodes($content, $root);
  removeNoiseNodes($content, $root);
  if (isWeChatHost(safeParseUrl(finalUrl))) {
    removeWeChatNoiseNodes($content, $root);
  }
  normalizeLinksAndMedia($content, $root, finalUrl);
  normalizeStructure($content, $root);
  sanitizeNodes($content, $root);
  removeEmptyNodes($content, $root);

  return normalizeExtractedHtml($root.html() ?? "");
}

function selectContentRoot($: CheerioAPI) {
  const preferredCandidates = uniqueElements(
    CONTENT_PREFERRED_SELECTORS.flatMap((selector) => $(selector).toArray())
      .filter(isElementNode)
      .filter((element) => getNodeText($(element)).length >= 120),
  );
  const preferredMatch = pickBestCandidate($, preferredCandidates, 40);
  if (preferredMatch) {
    return $(preferredMatch) as Cheerio<Element>;
  }

  const genericCandidates = uniqueElements(
    $("article, main, [role='main'], section, div")
      .toArray()
      .filter(isElementNode)
      .filter((element) => getNodeText($(element)).length >= 160),
  );
  const genericMatch = pickBestCandidate($, genericCandidates, 60);

  return genericMatch ? ($(genericMatch) as Cheerio<Element>) : ($("body").first() as Cheerio<Element>);
}

function pickBestCandidate($: CheerioAPI, candidates: Element[], minimumScore: number) {
  let bestCandidate: Element | null = null;
  let bestScore = minimumScore;

  for (const candidate of candidates) {
    const score = scoreCandidate($, candidate);
    if (score > bestScore) {
      bestCandidate = candidate;
      bestScore = score;
    }
  }

  return bestCandidate;
}

function scoreCandidate($: CheerioAPI, element: Element) {
  const $element = $(element);
  const textLength = getNodeText($element).length;
  if (textLength < 160) {
    return -Infinity;
  }

  const paragraphCount = $element.find("p").length;
  const headingCount = $element.find("h1,h2,h3,h4,h5,h6").length;
  const listItemCount = $element.find("li").length;
  const blockquoteCount = $element.find("blockquote").length;
  const preCount = $element.find("pre").length;
  const imageCount = $element.find("img").length;
  const linkTextLength = $element
    .find("a")
    .toArray()
    .reduce((total, link) => total + getNodeText($(link)).length, 0);
  const linkDensity = linkTextLength / Math.max(textLength, 1);
  const signature = getElementSignature($element);

  let score =
    textLength * 0.035 +
    paragraphCount * 24 +
    headingCount * 28 +
    listItemCount * 8 +
    blockquoteCount * 18 +
    preCount * 22 +
    imageCount * 10;

  if (CONTENT_POSITIVE_KEYWORDS.test(signature)) {
    score += 120;
  }

  if (CONTENT_NEGATIVE_KEYWORDS.test(signature)) {
    score -= 140;
  }

  score -= linkDensity * 220;

  return score;
}

function removeNoiseNodes($: CheerioAPI, $root: Cheerio<Element>) {
  $root.find("script, style, noscript, iframe, object, embed, svg, form, button, input, textarea, select, dialog, template, canvas, nav, aside, footer").remove();
  $root.find("[hidden], [aria-hidden='true']").remove();

  for (const element of $root.find("*").toArray().reverse()) {
    const $element = $(element);
    if (shouldRemoveBoilerplateNode($, $element)) {
      $element.remove();
    }
  }
}

function removeWeChatNoiseNodes($: CheerioAPI, $root: Cheerio<Element>) {
  for (const selector of WECHAT_NOISE_SELECTORS) {
    $root.find(selector).remove();
  }
}

function shouldRemoveBoilerplateNode($: CheerioAPI, $element: Cheerio<Element>) {
  const tagName = getTagName($element);
  if (!tagName) {
    return false;
  }

  const signature = getElementSignature($element);
  const text = getNodeText($element);
  const textLength = text.length;

  if ((tagName === "nav" || tagName === "aside" || tagName === "footer") && textLength < 2_000) {
    return true;
  }

  if (CONTENT_NEGATIVE_KEYWORDS.test(signature) && !CONTENT_POSITIVE_KEYWORDS.test(signature)) {
    return true;
  }

  if (textLength > 0 && textLength < 260 && BOILERPLATE_TEXT_PATTERNS.test(text)) {
    return true;
  }

  if (textLength > 0 && textLength < 1_200 && getLinkDensity($, $element) > 0.55) {
    return true;
  }

  return false;
}

function normalizeLinksAndMedia($: CheerioAPI, $root: Cheerio<Element>, finalUrl: string) {
  for (const anchor of $root.find("a").toArray()) {
    const $anchor = $(anchor);
    const href = resolveUrl($anchor.attr("href") ?? null, finalUrl);

    if (!href) {
      $anchor.replaceWith($anchor.contents());
      continue;
    }

    $anchor.attr("href", href);
  }

  for (const image of $root.find("img").toArray()) {
    const $image = $(image);
    const src = resolveUrl(resolveImageSource($image), finalUrl);

    if (!src) {
      $image.remove();
      continue;
    }

    $image.attr("src", src);

    const alt = normalizeWhitespace($image.attr("alt") ?? null);
    if (alt) {
      $image.attr("alt", alt);
    } else {
      $image.removeAttr("alt");
    }
  }

  $root.find("source").remove();
}

function normalizeStructure($: CheerioAPI, $root: Cheerio<Element>) {
  for (const element of $root.find("section, article, div").toArray().reverse()) {
    const $element = $(element);
    if (isParagraphLike($, $element)) {
      renameTag($element, "p");
    }
  }

  for (const span of $root.find("span").toArray().reverse()) {
    $(span).replaceWith($(span).contents());
  }

  for (const container of $root.find("div, section, article").toArray().reverse()) {
    const $container = $(container);
    if (shouldUnwrapContainer($, $container)) {
      $container.replaceWith($container.contents());
    }
  }
}

function isParagraphLike($: CheerioAPI, $element: Cheerio<Element>) {
  const tagName = getTagName($element);
  if (!tagName || !["section", "article", "div"].includes(tagName)) {
    return false;
  }

  if ($element.find("p, ul, ol, li, blockquote, pre, figure, img, table, h1, h2, h3, h4, h5, h6").length > 0) {
    return false;
  }

  const textLength = getNodeText($element).length;
  if (textLength < 8) {
    return false;
  }

  return getLinkDensity($, $element) < 0.4;
}

function shouldUnwrapContainer($: CheerioAPI, $element: Cheerio<Element>) {
  const tagName = getTagName($element);
  if (!tagName || !["div", "section", "article"].includes(tagName)) {
    return false;
  }

  const childElements = $element.children().toArray();
  const ownText = getOwnText($element);

  if (childElements.length === 1 && ownText.length === 0) {
    return true;
  }

  if (childElements.length > 0 && ownText.length === 0 && !CONTENT_POSITIVE_KEYWORDS.test(getElementSignature($element))) {
    return true;
  }

  return false;
}

function sanitizeNodes($: CheerioAPI, $root: Cheerio<Element>) {
  for (const node of $root.find("*").toArray().reverse()) {
    const $node = $(node);
    const tagName = getTagName($node);

    if (!tagName) {
      continue;
    }

    if (!ALLOWED_TAGS.has(tagName)) {
      $node.replaceWith($node.contents());
      continue;
    }

    sanitizeAttributes($node, tagName);
  }
}

function sanitizeAttributes($element: Cheerio<Element>, tagName: string) {
  const allowedAttributes = new Set(
    tagName === "a"
      ? ["href", "title"]
      : tagName === "img"
        ? ["src", "alt", "title"]
        : tagName === "td" || tagName === "th"
          ? ["colspan", "rowspan"]
          : [],
  );

  const attributes = Object.keys($element.attr() ?? {});
  for (const attribute of attributes) {
    if (!allowedAttributes.has(attribute)) {
      $element.removeAttr(attribute);
    }
  }
}

function removeEmptyNodes($: CheerioAPI, $root: Cheerio<Element>) {
  for (const node of $root.find("*").toArray().reverse()) {
    const $node = $(node);
    const tagName = getTagName($node);

    if (!tagName || ["img", "br", "hr"].includes(tagName)) {
      continue;
    }

    if (getNodeText($node).length > 0) {
      continue;
    }

    if ($node.children().length > 0) {
      continue;
    }

    $node.remove();
  }
}

function normalizeExtractedHtml(html: string) {
  return html.replace(/\u00a0/g, " ").replace(/>\s+</g, "><").trim();
}

function trimReadableHtml(contentHtml: string, title: string) {
  if (!contentHtml) {
    return "";
  }

  const $content = load(`<body>${contentHtml}</body>`);
  const $body = $content("body");

  const $firstHeading = $body.children("h1, h2, h3").first();
  if ($firstHeading.length > 0 && normalizeWhitespace($firstHeading.text()) === normalizeWhitespace(title)) {
    $firstHeading.remove();
  }

  for (const node of $body.children().toArray()) {
    const $node = $content(node);
    const text = getNodeText($node);

    if (!text || text.length > 120 || !LEADING_META_TEXT_PATTERNS.test(text)) {
      break;
    }

    $node.remove();
  }

  return normalizeExtractedHtml($body.html() ?? "");
}

function extractTitle($: CheerioAPI, finalUrl: string) {
  const title =
    cleanText($("title").first().text()) ?? extractMetaContent($, "og:title") ?? extractMetaContent($, "twitter:title");

  if (title) {
    return title;
  }

  const finalPageUrl = safeParseUrl(finalUrl);
  if (finalPageUrl && isWeChatHost(finalPageUrl)) {
    return extractWeChatTitle($);
  }

  return null;
}

function extractLang($: CheerioAPI) {
  return cleanText($("html").first().attr("lang") ?? null);
}

function extractCanonicalUrl($: CheerioAPI, finalUrl: string) {
  const candidate = $("link[rel]")
    .toArray()
    .find((element) => $(element).attr("rel")?.toLowerCase().includes("canonical"))
    ?.attribs?.href;

  if (!candidate) {
    return null;
  }

  try {
    return new URL(candidate, finalUrl).toString();
  } catch {
    return null;
  }
}

function extractAuthor($: CheerioAPI) {
  return extractMetaContent($, "author") ?? extractMetaContent($, "article:author");
}

function extractMetaContent($: CheerioAPI, name: string) {
  const normalizedName = name.toLowerCase();

  for (const meta of $("meta").toArray()) {
    const metaName = $(meta).attr("name")?.toLowerCase();
    const metaProperty = $(meta).attr("property")?.toLowerCase();
    if (metaName === normalizedName || metaProperty === normalizedName) {
      return cleanText($(meta).attr("content") ?? null);
    }
  }

  return null;
}

function htmlToPlainText(html: string) {
  const withBreaks = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|section|article|li|ul|ol|h1|h2|h3|h4|h5|h6|blockquote|figure|figcaption|pre|tr|table|thead|tbody)>/gi, "\n");

  const withoutTags = withBreaks.replace(/<[^>]+>/g, " ");
  const decoded = decodeHtmlEntities(withoutTags);

  return decoded
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'");
}

function cleanText(value: string | null) {
  if (!value) {
    return null;
  }

  return decodeHtmlEntities(value).replace(/\s+/g, " ").trim() || null;
}

function normalizeWhitespace(value: string | null) {
  return value?.replace(/\s+/g, " ").trim() || null;
}

function resolveUrl(value: string | null, baseUrl: string) {
  if (!value) {
    return null;
  }

  try {
    const resolved = new URL(value, baseUrl);
    if (!["http:", "https:"].includes(resolved.protocol)) {
      return null;
    }

    return resolved.toString();
  } catch {
    return null;
  }
}

function resolveImageSource($image: Cheerio<Element>) {
  const candidates = [
    $image.attr("src"),
    $image.attr("data-src"),
    $image.attr("data-actualsrc"),
    $image.attr("data-original"),
    $image.attr("data-lazy-src"),
    $image.attr("data-url"),
    extractSrcFromSrcSet($image.attr("srcset") ?? null),
  ];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }

    if (candidate.startsWith("data:")) {
      continue;
    }

    return candidate;
  }

  return null;
}

function extractSrcFromSrcSet(value: string | null) {
  if (!value) {
    return null;
  }

  const firstCandidate = value.split(",")[0]?.trim();
  if (!firstCandidate) {
    return null;
  }

  return firstCandidate.split(/\s+/)[0] ?? null;
}

function renameTag($element: Cheerio<Element>, nextTagName: string) {
  const node = $element.get(0);
  if (!node) {
    return;
  }

  node.tagName = nextTagName;
  node.name = nextTagName;
}

function uniqueElements(elements: Element[]) {
  const seen = new Set<Element>();

  return elements.filter((element) => {
    if (seen.has(element)) {
      return false;
    }

    seen.add(element);
    return true;
  });
}

function removeCommentNodes($: CheerioAPI, $root: Cheerio<Element>) {
  const nodes = [...$root.contents().toArray(), ...$root.find("*").contents().toArray()];

  for (const node of nodes) {
    if (node.type === "comment") {
      $(node).remove();
    }
  }
}

function getNodeText($element: Cheerio<AnyNode>) {
  return normalizeWhitespace($element.text()) ?? "";
}

function getOwnText($element: Cheerio<Element>) {
  const ownText = $element
    .contents()
    .toArray()
    .filter((node) => node.type === "text")
    .map((node) => normalizeWhitespace(("data" in node ? node.data : "") ?? ""))
    .filter((value): value is string => Boolean(value))
    .join(" ");

  return ownText.trim();
}

function getElementSignature($element: Cheerio<Element>) {
  return [
    getTagName($element),
    $element.attr("id"),
    $element.attr("class"),
    $element.attr("role"),
    $element.attr("aria-label"),
  ]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();
}

function getTagName($element: Cheerio<Element>) {
  return $element.get(0)?.tagName?.toLowerCase() ?? null;
}

function getLinkDensity($: CheerioAPI, $element: Cheerio<Element>) {
  const textLength = getNodeText($element).length;
  if (textLength === 0) {
    return 0;
  }

  const linkTextLength = $element
    .find("a")
    .toArray()
    .reduce((total, link) => total + getNodeText($(link)).length, 0);

  return linkTextLength / textLength;
}

function safeParseUrl(value: string) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isWeChatHost(url: URL | null) {
  return url?.hostname === "mp.weixin.qq.com";
}

function isWeChatVerificationPage(requestUrl: URL, finalUrl: URL | null, rawHtml: string) {
  const isWeChatRequest = isWeChatHost(requestUrl) || isWeChatHost(finalUrl);
  if (!isWeChatRequest) {
    return false;
  }

  if (finalUrl?.pathname === "/mp/wappoc_appmsgcaptcha") {
    return true;
  }

  const pageText = htmlToPlainText(rawHtml).slice(0, 1_000);

  return (
    /当前环境异常/.test(pageText) ||
    /完成验证后即可继续访问/.test(pageText) ||
    /去验证/.test(pageText) ||
    /环境异常/.test(pageText) ||
    /wappoc_appmsgcaptcha/i.test(rawHtml)
  );
}

function extractWeChatTitle($: CheerioAPI) {
  return (
    cleanText($("#activity-name").first().text()) ??
    cleanText($(".js_title_inner").first().text()) ??
    extractMetaContent($, "og:title")
  );
}

function isElementNode(node: AnyNode): node is Element {
  return node.type === "tag" || node.type === "script" || node.type === "style";
}
