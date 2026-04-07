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
const WECHAT_LOW_SIGNAL_TEXT_PATTERNS = /微信扫一扫|使用小程序|向上滑动看下一个|使用完整服务/i;
const WECHAT_INTERMEDIATE_TEXT_PATTERNS =
  /账号已迁移|该公众号已迁移|已迁移至新的账号|原账号已回收|若需访问原文章链接|访问原文章|点击下方按钮/i;
const WECHAT_END_MARKER_TEXT_PATTERNS = /^(?:（完）|\(完\)|全文完|完)$/;
const WECHAT_TRAILING_SEPARATOR_PATTERNS = /^(?:[.\-_*•。·…\s]{6,}|\.{6,}|。{6,}|_{6,}|\*{6,}|•{6,})$/;
const WECHAT_TRAILING_PROMO_TEXT_PATTERNS =
  /Tips[:：]|后台私信|交流群|加助理|网址[:：]|自动交易系统|复利吃息系统|知识星球|星球|私董会|定投|X ID[:：]|星标|感谢你的阅读|欢迎⭐|欢迎\*|web3leon|aidog\.xyz/i;
const META_AUTHOR_KEYS = [
  "author",
  "article:author",
  "og:article:author",
  "og:author",
  "twitter:creator",
  "parsely-author",
  "dc.creator",
  "dc:creator",
  "byline",
] as const;
const BOILERPLATE_HARD_PATTERNS =
  /^(?:相关阅读|推荐阅读|猜你喜欢|相关推荐|上一篇|下一篇|share this|related articles|read more)/i;
const META_PUBLISHED_AT_KEYS = [
  "article:published_time",
  "og:article:published_time",
  "og:published_time",
  "published_time",
  "publishdate",
  "pubdate",
  "date",
  "dc.date",
];
const JSON_LD_PUBLISHED_AT_KEYS = ["datePublished", "dateCreated", "uploadDate", "dateModified"] as const;
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
  "caption",
  "img",
  "a",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "del",
  "sup",
  "sub",
  "br",
  "hr",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
]);
const STRUCTURE_PRESERVE_TAGS = new Set([
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "caption",
  "ul",
  "ol",
  "blockquote",
  "pre",
  "figure",
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

export type ExtractedWebPageMetadata = Pick<ExtractedWebPage, "finalUrl" | "canonicalUrl" | "author" | "publishedAt">;

export async function extractWebPage(url: string): Promise<ExtractedWebPage> {
  const fetchedPage = await fetchWebPageDocument(url);

  return extractWebPageFromHtml({
    requestUrl: fetchedPage.requestUrl,
    finalUrl: fetchedPage.finalUrl,
    rawHtml: fetchedPage.rawHtml,
  });
}

export async function extractWebPageMetadata(
  url: string,
  options?: {
    signal?: AbortSignal;
  },
): Promise<ExtractedWebPageMetadata> {
  const fetchedPage = await fetchWebPageDocument(url, options);

  return extractWebPageMetadataFromHtml({
    requestUrl: fetchedPage.requestUrl,
    finalUrl: fetchedPage.finalUrl,
    rawHtml: fetchedPage.rawHtml,
  });
}

export function extractWebPageMetadataFromHtml(input: {
  requestUrl: string;
  finalUrl?: string;
  rawHtml: string;
}): ExtractedWebPageMetadata {
  const finalUrl = input.finalUrl || input.requestUrl;
  const rawHtml = input.rawHtml;
  const $ = load(rawHtml);

  return {
    finalUrl,
    canonicalUrl: extractCanonicalUrl($, finalUrl),
    author: extractAuthor($, finalUrl, rawHtml),
    publishedAt: extractPublishedAt($, finalUrl, rawHtml),
  };
}

export function extractWebPageFromHtml(input: {
  requestUrl: string;
  finalUrl?: string;
  rawHtml: string;
}): ExtractedWebPage {
  const requestUrl = new URL(input.requestUrl);
  const finalUrl = input.finalUrl || input.requestUrl;
  const rawHtml = input.rawHtml;

  const $ = load(rawHtml);
  const weChatInlineReadablePayload = extractWeChatInlineReadablePayload(rawHtml);
  const shouldUseWeChatInlineReadablePayload =
    Boolean(weChatInlineReadablePayload) && isWeChatHost(safeParseUrl(finalUrl)) && !hasWeChatReadableContentContainer($);

  assertPageIsReadable(requestUrl, finalUrl, $, rawHtml, {
    hasWeChatInlineReadablePayload: shouldUseWeChatInlineReadablePayload,
  });

  const title = extractTitle($, finalUrl) ?? weChatInlineReadablePayload?.title ?? new URL(finalUrl).hostname;
  const lang = extractLang($);
  const canonicalUrl = extractCanonicalUrl($, finalUrl);
  const author = extractAuthor($, finalUrl, rawHtml) ?? weChatInlineReadablePayload?.author ?? null;
  const publishedAt = extractPublishedAt($, finalUrl, rawHtml) ?? weChatInlineReadablePayload?.publishedAt ?? null;
  const contentHtml = shouldUseWeChatInlineReadablePayload
    ? trimReadableHtml(buildParagraphHtmlFromPlainText(weChatInlineReadablePayload?.plainText ?? ""), title, finalUrl)
    : trimReadableHtml(extractReadableHtml($, finalUrl), title, finalUrl);
  const plainText = htmlToPlainText(contentHtml);

  if (!plainText) {
    throw new RouteError("EXTRACTION_EMPTY", 422, "The page was fetched but no readable text was extracted.");
  }

  assertReadableExtractionQuality(finalUrl, plainText);

  const excerpt = plainText.slice(0, 240);
  const wordCount = countReadableUnits(plainText);
  const textHash = createHash("sha256").update(plainText).digest("hex");

  return {
    finalUrl,
    canonicalUrl,
    title,
    lang,
    author,
    publishedAt,
    excerpt,
    contentHtml: contentHtml || null,
    plainText,
    rawHtml,
    wordCount,
    textHash,
  };
}

async function fetchWebPageDocument(
  url: string,
  options?: {
    signal?: AbortSignal;
  },
) {
  const requestUrl = new URL(url);
  let response: Response;

  try {
    response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      headers: buildRequestHeaders(requestUrl),
      signal: options?.signal,
    });
  } catch {
    throw new RouteError("FETCH_FAILED", 502, `Failed to fetch "${url}".`);
  }

  if (!response.ok) {
    throw new RouteError("FETCH_FAILED", 502, `Failed to fetch "${url}".`);
  }

  return {
    requestUrl: requestUrl.toString(),
    finalUrl: response.url || url,
    rawHtml: await response.text(),
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

function assertPageIsReadable(
  requestUrl: URL,
  finalUrl: string,
  $: CheerioAPI,
  rawHtml: string,
  options?: {
    hasWeChatInlineReadablePayload?: boolean;
  },
) {
  const finalPageUrl = safeParseUrl(finalUrl);
  const bodyHtml = extractBodyHtml($, rawHtml);
  const bodyText = htmlToPlainText(bodyHtml).slice(0, 1_500);

  if (isWeChatVerificationPage(requestUrl, finalPageUrl, bodyText, rawHtml)) {
    throw new RouteError(
      "SOURCE_VERIFICATION_REQUIRED",
      422,
      "来源站点触发验证或环境异常，当前无法稳定抓取正文。",
    );
  }

  if (isWeChatShareShellPage($, finalPageUrl, options?.hasWeChatInlineReadablePayload ?? false)) {
    throw new RouteError("EXTRACTION_UNREADABLE", 422, "来源站点返回了微信分享壳页面，无法提取可阅读正文。");
  }

  if (isWeChatIntermediatePage($, finalPageUrl, bodyText)) {
    throw new RouteError("EXTRACTION_UNREADABLE", 422, "来源站点返回了微信迁移或跳转说明页，无法提取可阅读正文。");
  }

  if (VERIFICATION_PAGE_PATTERNS.test(bodyText) && bodyText.length < 800) {
    throw new RouteError("SOURCE_VERIFICATION_REQUIRED", 422, "来源站点要求验证，当前无法稳定抓取正文。");
  }

  if (SHELL_PAGE_PATTERNS.test(bodyText) && bodyText.length < 600) {
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
    if (BOILERPLATE_HARD_PATTERNS.test(text)) {
      return true;
    }

    if (CONTENT_NEGATIVE_KEYWORDS.test(signature)) {
      return true;
    }

    if (getLinkDensity($, $element) > 0.28) {
      return true;
    }
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
  if (childElements.some((child) => STRUCTURE_PRESERVE_TAGS.has((child as Element).tagName?.toLowerCase() ?? ""))) {
    return false;
  }

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
        : tagName === "th"
          ? ["colspan", "rowspan", "scope"]
          : tagName === "td"
            ? ["colspan", "rowspan"]
            : tagName === "ol"
              ? ["start", "reversed"]
              : tagName === "li"
                ? ["value"]
                : tagName === "blockquote"
                  ? ["cite"]
                  : tagName === "table"
                    ? ["summary"]
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

function buildParagraphHtmlFromPlainText(plainText: string) {
  const normalized = normalizeReadablePlainText(plainText);
  if (!normalized) {
    return "";
  }

  return normalized
    .split(/\n{2,}/)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function trimReadableHtml(contentHtml: string, title: string, finalUrl: string) {
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

  if (isWeChatHost(safeParseUrl(finalUrl))) {
    removeWeChatTrailingPromo($content, $body);
  }

  return normalizeExtractedHtml($body.html() ?? "");
}

function removeWeChatTrailingPromo($: CheerioAPI, $body: Cheerio<Element>) {
  const children = $body.children().toArray();
  const startIndex = findWeChatTrailingPromoStart($, children);

  if (startIndex === null) {
    return;
  }

  for (const node of children.slice(startIndex)) {
    $(node).remove();
  }
}

function findWeChatTrailingPromoStart($: CheerioAPI, children: AnyNode[]) {
  if (children.length === 0) {
    return null;
  }

  const windowStart = Math.max(0, children.length - 12);
  const texts = children.map((node) => getNodeText($(node)));
  let endMarkerIndex = -1;

  for (let index = windowStart; index < texts.length; index += 1) {
    if (WECHAT_END_MARKER_TEXT_PATTERNS.test(texts[index])) {
      endMarkerIndex = index;
    }
  }

  if (endMarkerIndex >= 0) {
    for (let index = endMarkerIndex + 1; index < texts.length; index += 1) {
      if (isWeChatTrailingPromoText(texts[index])) {
        return index;
      }
    }
  }

  let suspiciousRunStart: number | null = null;
  let suspiciousCount = 0;

  for (let index = windowStart; index < texts.length; index += 1) {
    if (isWeChatTrailingPromoText(texts[index])) {
      suspiciousRunStart ??= index;
      suspiciousCount += 1;

      if (suspiciousCount >= 2) {
        return suspiciousRunStart;
      }

      continue;
    }

    if (texts[index].length > 0) {
      suspiciousRunStart = null;
      suspiciousCount = 0;
    }
  }

  return null;
}

function isWeChatTrailingPromoText(text: string) {
  const normalized = normalizeWhitespace(text) ?? "";
  if (!normalized) {
    return false;
  }

  if (normalized.length <= 160 && WECHAT_TRAILING_SEPARATOR_PATTERNS.test(normalized)) {
    return true;
  }

  return WECHAT_TRAILING_PROMO_TEXT_PATTERNS.test(normalized);
}

function assertReadableExtractionQuality(finalUrl: string, plainText: string) {
  const finalPageUrl = safeParseUrl(finalUrl);
  if (!isWeChatHost(finalPageUrl)) {
    return;
  }

  const readableUnitCount = countReadableUnits(plainText);
  if (readableUnitCount < 180 && WECHAT_INTERMEDIATE_TEXT_PATTERNS.test(plainText)) {
    throw new RouteError("EXTRACTION_UNREADABLE", 422, "提取结果只包含微信迁移或跳转说明，未拿到可阅读正文。");
  }

  if (readableUnitCount < 80 && WECHAT_LOW_SIGNAL_TEXT_PATTERNS.test(plainText)) {
    throw new RouteError("EXTRACTION_UNREADABLE", 422, "提取结果只包含微信分享壳页提示，未拿到可阅读正文。");
  }
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

function extractAuthor($: CheerioAPI, finalUrl: string, rawHtml: string) {
  const finalPageUrl = safeParseUrl(finalUrl);

  for (const key of META_AUTHOR_KEYS) {
    const candidate = normalizeAuthorCandidate(extractMetaContent($, key));
    if (candidate) {
      return candidate;
    }
  }

  const jsonLdAuthor = extractJsonLdAuthor($);
  if (jsonLdAuthor) {
    return jsonLdAuthor;
  }

  if (isWeChatHost(finalPageUrl)) {
    const weChatAuthor = extractWeChatAuthor($, rawHtml);
    if (weChatAuthor) {
      return weChatAuthor;
    }
  }

  const authorFromContentRoot = extractAuthorFromSelectors($, selectContentRoot($));
  if (authorFromContentRoot) {
    return authorFromContentRoot;
  }

  const body = $("body").first() as Cheerio<Element>;
  const authorFromBody = extractAuthorFromSelectors($, body);
  if (authorFromBody) {
    return authorFromBody;
  }

  if (isWeChatHost(finalPageUrl)) {
    return extractWeChatAuthor($, rawHtml);
  }

  return null;
}

function extractAuthorFromSelectors($: CheerioAPI, $root: Cheerio<Element>) {
  const selectors = [
    "[itemprop='author'] [itemprop='name']",
    "[itemprop='author']",
    "[rel='author']",
    ".article-author",
    ".post-author",
    ".entry-author",
    ".byline",
    ".author",
  ];

  for (const selector of selectors) {
    for (const element of $root.find(selector).toArray()) {
      const $element = $(element);
      const candidate =
        normalizeAuthorCandidate(cleanText($element.text())) ??
        normalizeAuthorCandidate(cleanText($element.attr("content") ?? null)) ??
        normalizeAuthorCandidate(parseAuthorFromByline(getNodeText($element)));
      if (candidate) {
        return candidate;
      }
    }
  }

  return null;
}

function extractJsonLdAuthor($: CheerioAPI) {
  for (const script of $("script[type='application/ld+json']").toArray()) {
    const scriptContent = $(script).text();
    if (!scriptContent.trim()) {
      continue;
    }

    try {
      const parsedJson = JSON.parse(scriptContent) as unknown;
      const author = findAuthorInJsonLd(parsedJson);
      if (author) {
        return author;
      }
    } catch {
      continue;
    }
  }

  return null;
}

function findAuthorInJsonLd(value: unknown): string | null {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const parsed = findAuthorInJsonLd(item);
      if (parsed) {
        return parsed;
      }
    }

    return null;
  }

  const fromValue = parseJsonLdAuthorValue(value);
  if (fromValue) {
    return fromValue;
  }

  if (typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  for (const nestedValue of Object.values(record)) {
    const parsed = findAuthorInJsonLd(nestedValue);
    if (parsed) {
      return parsed;
    }
  }

  return null;
}

function parseJsonLdAuthorValue(value: unknown): string | null {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return normalizeAuthorCandidate(value);
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const parsed = parseJsonLdAuthorValue(item);
      if (parsed) {
        return parsed;
      }
    }

    return null;
  }

  if (typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  if ("author" in record) {
    const parsed = parseJsonLdAuthorValue(record.author);
    if (parsed) {
      return parsed;
    }
  }

  if ("creator" in record) {
    const parsed = parseJsonLdAuthorValue(record.creator);
    if (parsed) {
      return parsed;
    }
  }

  if (typeof record.name === "string") {
    const parsed = normalizeAuthorCandidate(record.name);
    if (parsed) {
      return parsed;
    }
  }

  return null;
}

function extractWeChatAuthor($: CheerioAPI, rawHtml: string) {
  const scriptNickname =
    rawHtml.match(/\bnick_name\s*:\s*JsDecode\(\s*'([\s\S]{1,160}?)'\s*\)/i)?.[1] ??
    rawHtml.match(/\bprofile_nickname\s*[:=]\s*["']([^"'\\\n]{1,80})["']/i)?.[1] ??
    rawHtml.match(/\bnickname\s*[:=]\s*(?:htmlDecode\()?["']([^"'\\\n]{1,80})["']\)?/i)?.[1] ??
    null;
  const decodedScriptNickname = normalizeAuthorCandidate(decodeWeChatJsString(scriptNickname));

  if (decodedScriptNickname) {
    return decodedScriptNickname;
  }

  const selectorCandidates = [
    "#meta_content .rich_media_meta_text",
    "#js_name",
    ".profile_nickname",
    ".rich_media_meta.rich_media_meta_nickname",
    ".rich_media_meta.rich_media_meta_text",
  ];

  for (const selector of selectorCandidates) {
    const candidate = normalizeAuthorCandidate(cleanText($(selector).first().text()));
    if (candidate) {
      return candidate;
    }
  }

  const bylineSelectors = ["#js_content > section", "#js_content > p", "#img-content > section", "#img-content > p"];
  for (const selector of bylineSelectors) {
    for (const element of $(selector).slice(0, 3).toArray()) {
      const candidate = parseAuthorFromByline(getNodeText($(element)));
      if (candidate) {
        return candidate;
      }
    }
  }

  return null;
}

function parseAuthorFromByline(value: string) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) {
    return null;
  }

  const matchedByline =
    normalized.match(/^(?:文|作者|撰文|By|BY|by)\s*[:：]\s*(.+)$/i)?.[1] ??
    normalized.match(/^(?:作者|By|BY|by)\s+(.+)$/i)?.[1] ??
    null;

  return normalizeAuthorCandidate(matchedByline);
}

function normalizeAuthorCandidate(value: string | null) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) {
    return null;
  }

  const candidate = normalized
    .replace(/^(?:原创|转载)?\s*(?:作者|文|撰文|By|BY|by)\s*[:：]\s*/i, "")
    .replace(/^@\s*/, "")
    .replace(/[，,。.!！?？;；:：\s]+$/g, "")
    .trim();

  if (!candidate || candidate.length > 60) {
    return null;
  }

  if (/https?:\/\//i.test(candidate) || /[\r\n]/.test(candidate)) {
    return null;
  }

  if (/^data-[a-z0-9_-]+$/i.test(candidate)) {
    return null;
  }

  if (/^(?:微信扫一扫|使用小程序|向上滑动看下一个|点击下方按钮|访问原文章)$/i.test(candidate)) {
    return null;
  }

  if (/^\d{4}[\/.-]\d{1,2}[\/.-]\d{1,2}/.test(candidate)) {
    return null;
  }

  if (/[。！？]/.test(candidate) && candidate.length > 20) {
    return null;
  }

  return candidate;
}

function extractPublishedAt($: CheerioAPI, finalUrl: string, rawHtml: string) {
  for (const key of META_PUBLISHED_AT_KEYS) {
    const parsed = parseDateValue(extractMetaContent($, key));
    if (parsed) {
      return parsed;
    }
  }

  for (const element of $("time").toArray()) {
    const parsed = parseDateValue(cleanText($(element).attr("datetime") ?? null) ?? cleanText($(element).text()));
    if (parsed) {
      return parsed;
    }
  }

  const jsonLdPublishedAt = extractJsonLdPublishedAt($);
  if (jsonLdPublishedAt) {
    return jsonLdPublishedAt;
  }

  if (isWeChatHost(safeParseUrl(finalUrl))) {
    return extractWeChatPublishedAt($, rawHtml);
  }

  return null;
}

function extractJsonLdPublishedAt($: CheerioAPI) {
  for (const script of $("script[type='application/ld+json']").toArray()) {
    const scriptContent = $(script).text();
    if (!scriptContent.trim()) {
      continue;
    }

    try {
      const parsedJson = JSON.parse(scriptContent) as unknown;
      const publishedAt = findPublishedAtInJsonLd(parsedJson);
      if (publishedAt) {
        return publishedAt;
      }
    } catch {
      continue;
    }
  }

  return null;
}

function findPublishedAtInJsonLd(value: unknown): Date | null {
  if (!value) {
    return null;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const parsed = findPublishedAtInJsonLd(item);
      if (parsed) {
        return parsed;
      }
    }

    return null;
  }

  if (typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  for (const key of JSON_LD_PUBLISHED_AT_KEYS) {
    const candidate = record[key];
    if (typeof candidate !== "string") {
      continue;
    }

    const parsed = parseDateValue(candidate);
    if (parsed) {
      return parsed;
    }
  }

  for (const nestedValue of Object.values(record)) {
    const parsed = findPublishedAtInJsonLd(nestedValue);
    if (parsed) {
      return parsed;
    }
  }

  return null;
}

function extractWeChatPublishedAt($: CheerioAPI, rawHtml: string) {
  const publishTimeText = cleanText($("#publish_time, em#publish_time, .publish_time").first().text());
  const publishTimeFromText = parseDateValue(publishTimeText);
  if (publishTimeFromText) {
    return publishTimeFromText;
  }

  const patterns = [
    /\b(?:(?:var|let|const)\s+|window\.)?ct\s*=\s*["']?(\d{10,13})["']?/i,
    /\bpublish_time\s*[:=]\s*["']?([0-9:\-T\s+]+)["']?/i,
    /\b(?:create_time|oriCreateTime)\s*[:=]\s*["']?([0-9:\-T\s+]+)["']?/i,
  ];

  for (const pattern of patterns) {
    const candidate = rawHtml.match(pattern)?.[1] ?? null;
    const parsed = parseDateValue(candidate);
    if (parsed) {
      return parsed;
    }
  }

  return null;
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

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function cleanText(value: string | null) {
  if (!value) {
    return null;
  }

  return decodeHtmlEntities(value).replace(/\s+/g, " ").trim() || null;
}

function parseDateValue(value: string | null) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) {
    return null;
  }

  if (/^\d{10}$/.test(normalized)) {
    const epochSeconds = Number(normalized);
    if (epochSeconds >= 946684800 && epochSeconds <= 4102444800) {
      return parseEpochMillis(epochSeconds * 1000);
    }
  }

  if (/^\d{13}$/.test(normalized)) {
    const epochMillis = Number(normalized);
    if (epochMillis >= 946684800000 && epochMillis <= 4102444800000) {
      return parseEpochMillis(epochMillis);
    }
  }

  const cjkDateMatch = normalized.match(
    /^(\d{4})[年\/\-.](\d{1,2})[月\/\-.](\d{1,2})日?(?:\s+(\d{1,2})(?::(\d{1,2}))?(?::(\d{1,2}))?)?$/,
  );
  if (cjkDateMatch) {
    const [, year, month, day, hour = "0", minute = "0", second = "0"] = cjkDateMatch;
    const withTimezone = `${year}-${padTwoDigits(month)}-${padTwoDigits(day)}T${padTwoDigits(hour)}:${padTwoDigits(minute)}:${padTwoDigits(second)}+08:00`;
    const parsedCjk = new Date(withTimezone);
    if (!Number.isNaN(parsedCjk.getTime())) {
      return parsedCjk;
    }
  }

  const parsed = new Date(normalized);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseEpochMillis(value: number) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function padTwoDigits(value: string) {
  return value.padStart(2, "0");
}

function normalizeWhitespace(value: string | null) {
  return value?.replace(/\s+/g, " ").trim() || null;
}

function normalizeReadablePlainText(value: string | null) {
  if (!value) {
    return "";
  }

  return value
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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

function extractBodyHtml($: CheerioAPI, rawHtml: string) {
  const $body = $("body").first();
  if ($body.length === 0) {
    return rawHtml;
  }

  return $.html($body) ?? rawHtml;
}

function countReadableUnits(text: string) {
  const normalized = normalizeWhitespace(text) ?? "";
  if (!normalized) {
    return 0;
  }

  const cjkCharacters = normalized.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu)?.length ?? 0;
  const latinTokens =
    normalized.match(/[A-Za-z0-9]+(?:[._'’-][A-Za-z0-9]+)*/g)?.length ?? 0;

  return cjkCharacters + latinTokens;
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

function isWeChatVerificationPage(requestUrl: URL, finalUrl: URL | null, bodyText: string, rawHtml: string) {
  const isWeChatRequest = isWeChatHost(requestUrl) || isWeChatHost(finalUrl);
  if (!isWeChatRequest) {
    return false;
  }

  if (finalUrl?.pathname === "/mp/wappoc_appmsgcaptcha") {
    return true;
  }

  return (
    /当前环境异常/.test(bodyText) ||
    /完成验证后即可继续访问/.test(bodyText) ||
    /去验证/.test(bodyText) ||
    /环境异常/.test(bodyText) ||
    /wappoc_appmsgcaptcha/i.test(rawHtml)
  );
}

function isWeChatShareShellPage($: CheerioAPI, finalUrl: URL | null, hasInlineReadablePayload = false) {
  if (!isWeChatHost(finalUrl)) {
    return false;
  }

  if (hasInlineReadablePayload) {
    return false;
  }

  const hasReadableContentContainer = hasWeChatReadableContentContainer($);
  if (hasReadableContentContainer) {
    return false;
  }

  return $("#js_article.share_content_page").length > 0 || $(".img_swiper_area, .share_media_swiper, #js_jump_wx_qrcode_dialog").length > 0;
}

function isWeChatIntermediatePage($: CheerioAPI, finalUrl: URL | null, bodyText: string) {
  if (!isWeChatHost(finalUrl)) {
    return false;
  }

  if (hasWeChatReadableContentContainer($)) {
    return false;
  }

  const title = normalizeWhitespace($("title").first().text()) ?? "";
  const readableUnitCount = countReadableUnits(bodyText);

  return readableUnitCount < 180 && (WECHAT_INTERMEDIATE_TEXT_PATTERNS.test(title) || WECHAT_INTERMEDIATE_TEXT_PATTERNS.test(bodyText));
}

function hasWeChatReadableContentContainer($: CheerioAPI) {
  return $("#img-content, #js_content, .rich_media_content").length > 0;
}

function extractWeChatTitle($: CheerioAPI) {
  return (
    cleanText($("#activity-name").first().text()) ??
    cleanText($(".js_title_inner").first().text()) ??
    extractMetaContent($, "og:title")
  );
}

function extractWeChatInlineReadablePayload(rawHtml: string) {
  const itemShowType =
    rawHtml.match(/\b(?:window\.)?item_show_type\s*=\s*['"]?(\d+)['"]?/i)?.[1] ??
    rawHtml.match(/\bitem_show_type\s*:\s*['"]?(\d+)['"]?/i)?.[1] ??
    null;

  if (itemShowType !== "10") {
    return null;
  }

  const plainText = normalizeReadablePlainText(
    decodeWeChatJsString(
      rawHtml.match(/\bcontent_noencode\s*:\s*JsDecode\(\s*'([\s\S]*?)'\s*\)\s*,\s*source_url\b/i)?.[1] ?? null,
    ),
  );
  if (!plainText) {
    return null;
  }

  return {
    title: cleanText(decodeWeChatJsString(rawHtml.match(/\btitle\s*:\s*JsDecode\(\s*'([\s\S]*?)'\s*\)/i)?.[1] ?? null)),
    author: normalizeAuthorCandidate(
      decodeWeChatJsString(rawHtml.match(/\bnick_name\s*:\s*JsDecode\(\s*'([\s\S]*?)'\s*\)/i)?.[1] ?? null),
    ),
    publishedAt: parseDateValue(
      rawHtml.match(/\b(?:(?:var|let|const)\s+|window\.)?ct\s*=\s*["']?(\d{10,13})["']?/i)?.[1] ?? null,
    ),
    plainText,
  };
}

function decodeWeChatJsString(value: string | null) {
  if (!value) {
    return null;
  }

  return value
    .replace(/\\x5c/g, "\\")
    .replace(/\\x0d/g, "\r")
    .replace(/\\x0a/g, "\n")
    .replace(/\\x22/g, '"')
    .replace(/\\x26/g, "&")
    .replace(/\\x27/g, "'")
    .replace(/\\x3c/g, "<")
    .replace(/\\x3e/g, ">");
}

function isElementNode(node: AnyNode): node is Element {
  return node.type === "tag" || node.type === "script" || node.type === "style";
}
