import { DocumentType } from "@prisma/client";

/**
 * Normalizes a URL by removing common tracking and test parameters.
 * Strips qa_*, codex_*, and utm_* parameters.
 */
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const params = new URLSearchParams(parsed.search);

    // List of parameters to strip
    const toStrip = [
      /^utm_/,
      /^qa_/,
      /^codex_/,
      "fbclid",
      "gclid",
      "msclkid",
      "mc_cid",
      "mc_eid",
      "_hsenc",
      "_hsmi",
      "ref",
      "source",
    ];

    const keysToRemove: string[] = [];
    for (const key of params.keys()) {
      if (toStrip.some((pattern) => (typeof pattern === "string" ? key === pattern : pattern.test(key)))) {
        keysToRemove.push(key);
      }
    }

    for (const key of keysToRemove) {
      params.delete(key);
    }

    parsed.search = params.toString();
    
    // Normalize trailing slash and common WeChat hostname variations if any
    let normalized = parsed.toString().replace(/\/$/, "");
    
    return normalized;
  } catch {
    return url;
  }
}

/**
 * Specifically handles WeChat URLs to get a stable canonical form.
 */
export function getWechatCanonicalUrl(url: string): string {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== "mp.weixin.qq.com") {
      return normalizeUrl(url);
    }

    // If it's the short form /s/[id], keep it as is (but normalize)
    if (parsed.pathname.startsWith("/s/")) {
      return `https://mp.weixin.qq.com${parsed.pathname.replace(/\/$/, "")}`;
    }

    // If it's the long form with params, keep only essential identity params
    const biz = parsed.searchParams.get("__biz");
    const mid = parsed.searchParams.get("mid");
    const idx = parsed.searchParams.get("idx");
    const sn = parsed.searchParams.get("sn");

    if (biz && mid && idx && sn) {
      return `https://mp.weixin.qq.com/s?__biz=${biz}&mid=${mid}&idx=${idx}&sn=${sn}`;
    }

    return normalizeUrl(url);
  } catch {
    return url;
  }
}

/**
 * Generates a stable dedupeKey for a document based on its type and metadata.
 */
export function generateDedupeKey(input: {
  type: DocumentType;
  sourceUrl?: string | null;
  canonicalUrl?: string | null;
  externalId?: string | null;
}): string | null {
  const { type, sourceUrl, canonicalUrl, externalId } = input;

  if (type === DocumentType.RSS_ITEM) {
    // For RSS, externalId (GUID) is the primary key. 
    // Fallback to normalized link if guid is missing.
    if (externalId) return `rss:${externalId}`;
    const url = canonicalUrl || sourceUrl;
    if (url) return `rss:url:${normalizeUrl(url)}`;
  }

  if (type === DocumentType.WEB_PAGE) {
    const url = canonicalUrl || sourceUrl;
    if (!url) return null;

    if (isWechatUrl(url)) {
      const canonical = getWechatCanonicalUrl(url);
      // Try to extract ID from /s/ form for more compact keys
      const sMatch = canonical.match(/\/s\/([a-zA-Z0-9_-]+)/);
      if (sMatch) return `wechat:s:${sMatch[1]}`;
      
      // Fallback to long form params
      return `wechat:url:${canonical}`;
    }

    // General web page
    if (externalId) return `web:ext:${externalId}`;
    return `web:url:${normalizeUrl(url)}`;
  }

  return null;
}

/**
 * Checks if a URL contains test or smoke parameters that should be blocked from production.
 */
export function isTestUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    for (const key of parsed.searchParams.keys()) {
      if (key.startsWith("qa_") || key.startsWith("codex_")) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

function isWechatUrl(url: string): boolean {
  try {
    return new URL(url).hostname === "mp.weixin.qq.com";
  } catch {
    return false;
  }
}
