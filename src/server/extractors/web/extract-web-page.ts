import { createHash } from "node:crypto";
import { RouteError } from "@/server/api/response";

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

  const title = extractTitle(rawHtml, finalUrl) ?? new URL(finalUrl).hostname;
  const lang = extractLang(rawHtml);
  const canonicalUrl = extractCanonicalUrl(rawHtml, finalUrl);
  const author = extractMetaContent(rawHtml, "author");
  const bodyHtml = extractReadableHtml(rawHtml);
  const plainText = htmlToPlainText(bodyHtml);

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
    contentHtml: bodyHtml || null,
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
}

function extractReadableHtml(rawHtml: string) {
  const articleHtml =
    extractTagContent(rawHtml, "article") ?? extractTagContent(rawHtml, "main") ?? extractTagContent(rawHtml, "body") ?? rawHtml;

  return articleHtml
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<noscript\b[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>/gi, "")
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, "")
    .trim();
}

function extractTitle(rawHtml: string, finalUrl: string) {
  const title =
    cleanText(firstMatch(rawHtml, /<title[^>]*>([\s\S]*?)<\/title>/i)) ??
    extractMetaContent(rawHtml, "og:title") ??
    extractMetaContent(rawHtml, "twitter:title");

  if (title) {
    return title;
  }

  const finalPageUrl = safeParseUrl(finalUrl);
  if (finalPageUrl && isWeChatHost(finalPageUrl)) {
    return extractWeChatTitle(rawHtml);
  }

  return null;
}

function extractLang(rawHtml: string) {
  return cleanText(firstMatch(rawHtml, /<html[^>]*\slang=["']([^"']+)["']/i));
}

function extractCanonicalUrl(rawHtml: string, finalUrl: string) {
  const candidate = firstMatch(rawHtml, /<link[^>]*rel=["'][^"']*canonical[^"']*["'][^>]*href=["']([^"']+)["'][^>]*>/i);

  if (!candidate) {
    return null;
  }

  try {
    return new URL(candidate, finalUrl).toString();
  } catch {
    return null;
  }
}

function extractMetaContent(rawHtml: string, name: string) {
  const pattern = new RegExp(
    `<meta[^>]*(?:name|property)=["'][^"']*${escapeForRegex(name)}[^"']*["'][^>]*content=["']([^"']+)["'][^>]*>`,
    "i",
  );

  return cleanText(firstMatch(rawHtml, pattern));
}

function extractTagContent(rawHtml: string, tag: string) {
  const pattern = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  return firstMatch(rawHtml, pattern);
}

function htmlToPlainText(html: string) {
  const withBreaks = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|section|article|li|ul|ol|h1|h2|h3|h4|h5|h6)>/gi, "\n");

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

function firstMatch(input: string, pattern: RegExp) {
  return input.match(pattern)?.[1] ?? null;
}

function escapeForRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

function extractWeChatTitle(rawHtml: string) {
  return (
    cleanText(firstMatch(rawHtml, /<h1[^>]*id=["']activity-name["'][^>]*>([\s\S]*?)<\/h1>/i)) ??
    cleanText(firstMatch(rawHtml, /<span[^>]*class=["'][^"']*js_title_inner[^"']*["'][^>]*>([\s\S]*?)<\/span>/i))
  );
}
