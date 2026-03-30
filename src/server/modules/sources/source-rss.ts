import { createHash } from "node:crypto";
import { load } from "cheerio";

export type DiscoveredFeed = {
  kind: "rss" | "atom";
  feedUrl: string;
  siteUrl: string | null;
};

export type ParsedFeedEntry = {
  externalId: string;
  url: string | null;
  title: string;
  categories: string[];
  author: string | null;
  publishedAt: Date | null;
  contentHtml: string | null;
  plainText: string;
  excerpt: string;
};

export type ParsedFeedDocument = {
  kind: "rss" | "atom";
  title: string;
  siteUrl: string | null;
  lang: string | null;
  entries: ParsedFeedEntry[];
};

type DiscoverFeedInput = {
  requestUrl: string;
  responseUrl: string;
  contentType: string | null;
  body: string;
};

type ParseFeedInput = {
  feedUrl: string;
  xml: string;
};

const FEED_CONTENT_TYPE_PATTERNS = /application\/(rss|atom)\+xml|application\/xml|text\/xml/i;

export function discoverFeedFromResponse(input: DiscoverFeedInput): DiscoveredFeed {
  const directKind = detectFeedKind(input.body, input.contentType);
  if (directKind) {
    const parsed = parseFeedDocument({
      feedUrl: input.responseUrl,
      xml: input.body,
    });

    return {
      kind: directKind,
      feedUrl: input.responseUrl,
      siteUrl: normalizeSiteUrl(parsed.siteUrl ?? safeParseUrl(input.requestUrl)?.origin ?? null),
    };
  }

  const $ = load(input.body);
  const candidates = $("link[rel]")
    .toArray()
    .map((element) => {
      const rel = ($(element).attr("rel") ?? "").toLowerCase();
      const type = ($(element).attr("type") ?? "").toLowerCase();
      const href = $(element).attr("href") ?? null;

      if (!rel.includes("alternate") || !href) {
        return null;
      }

      if (type.includes("rss+xml")) {
        return {
          kind: "rss" as const,
          href,
        };
      }

      if (type.includes("atom+xml")) {
        return {
          kind: "atom" as const,
          href,
        };
      }

      return null;
    })
    .filter((candidate): candidate is { kind: "rss" | "atom"; href: string } => Boolean(candidate));

  const candidate = candidates[0];
  if (!candidate) {
    throw new Error("No RSS or Atom feed was discovered from the provided locator.");
  }

  return {
    kind: candidate.kind,
    feedUrl: new URL(candidate.href, input.responseUrl).toString(),
    siteUrl: normalizeSiteUrl(input.responseUrl),
  };
}

export function parseFeedDocument(input: ParseFeedInput): ParsedFeedDocument {
  const kind = detectFeedKind(input.xml, null);
  if (!kind) {
    throw new Error("The fetched document is not a valid RSS or Atom feed.");
  }

  return kind === "atom" ? parseAtomFeed(input) : parseRssFeed(input);
}

function parseRssFeed(input: ParseFeedInput): ParsedFeedDocument {
  const $ = load(input.xml, { xmlMode: true });
  const $channel = $("channel").first();

  const title = cleanText($channel.children("title").first().text()) ?? safeParseUrl(input.feedUrl)?.hostname ?? "Untitled feed";
  const siteUrl = resolveUrl($channel.children("link").first().text(), input.feedUrl);
  const lang = cleanText($channel.children("language").first().text());
  const entries = $channel
    .children("item")
    .toArray()
    .map((item) => parseRssItem($, item, input.feedUrl))
    .filter((entry): entry is ParsedFeedEntry => Boolean(entry));

  return {
    kind: "rss",
    title,
    siteUrl: normalizeSiteUrl(siteUrl),
    lang,
    entries,
  };
}

function parseAtomFeed(input: ParseFeedInput): ParsedFeedDocument {
  const $ = load(input.xml, { xmlMode: true });
  const $feed = $("feed").first();

  const title = cleanText($feed.children("title").first().text()) ?? safeParseUrl(input.feedUrl)?.hostname ?? "Untitled feed";
  const siteUrl =
    resolveUrl(
      $feed
        .children("link")
        .toArray()
        .find((element) => {
          const rel = ($(element).attr("rel") ?? "").toLowerCase();
          return rel === "" || rel === "alternate";
        })
        ?.attribs?.href ?? null,
      input.feedUrl,
    ) ?? safeParseUrl(input.feedUrl)?.origin ?? null;
  const lang = cleanText($feed.attr("xml:lang") ?? $feed.attr("lang") ?? null);
  const entries = $feed
    .children("entry")
    .toArray()
    .map((entry) => parseAtomEntry($, entry, input.feedUrl))
    .filter((parsed): parsed is ParsedFeedEntry => Boolean(parsed));

  return {
    kind: "atom",
    title,
    siteUrl: normalizeSiteUrl(siteUrl),
    lang,
    entries,
  };
}

function parseRssItem($: ReturnType<typeof load>, item: Parameters<ReturnType<typeof load>>[0], feedUrl: string) {
  const $item = $(item);
  const url = resolveUrl(cleanText($item.children("link").first().text()), feedUrl);
  const title = cleanText($item.children("title").first().text()) ?? url ?? "Untitled item";
  const categories = extractRssCategories($, item);
  const author =
    cleanText($item.children("author").first().text()) ??
    cleanText($item.children("dc\\:creator").first().text()) ??
    cleanText($item.children("creator").first().text());
  const publishedAt = parseDate(
    cleanText($item.children("pubDate").first().text()) ?? cleanText($item.children("dc\\:date").first().text()),
  );
  const contentHtml =
    cleanText($item.children("content\\:encoded").first().text()) ??
    cleanText($item.children("encoded").first().text()) ??
    cleanText($item.children("description").first().text());
  const plainText = htmlToPlainText(contentHtml);
  const excerpt = buildExcerpt(plainText);
  const externalId =
    cleanText($item.children("guid").first().text()) ??
    url ??
    buildFallbackExternalId([title, excerpt, publishedAt?.toISOString() ?? null]);

  if (!title || !externalId || !plainText) {
    return null;
  }

  return {
    externalId,
    url,
    title,
    categories,
    author,
    publishedAt,
    contentHtml: contentHtml ? normalizeContentHtml(contentHtml) : null,
    plainText,
    excerpt,
  };
}

function parseAtomEntry($: ReturnType<typeof load>, entry: Parameters<ReturnType<typeof load>>[0], feedUrl: string) {
  const $entry = $(entry);
  const linkElement = $entry
    .children("link")
    .toArray()
    .find((element) => {
      const rel = ($(element).attr("rel") ?? "").toLowerCase();
      return rel === "" || rel === "alternate";
    });
  const url = resolveUrl(linkElement ? $(linkElement).attr("href") ?? null : null, feedUrl);
  const title = cleanText($entry.children("title").first().text()) ?? url ?? "Untitled item";
  const categories = extractAtomCategories($, entry);
  const author =
    cleanText($entry.children("author").children("name").first().text()) ??
    cleanText($entry.children("author").first().text());
  const publishedAt = parseDate(
    cleanText($entry.children("published").first().text()) ?? cleanText($entry.children("updated").first().text()),
  );
  const contentHtml =
    cleanText($entry.children("content").first().text()) ?? cleanText($entry.children("summary").first().text());
  const plainText = htmlToPlainText(contentHtml);
  const excerpt = buildExcerpt(plainText);
  const externalId =
    cleanText($entry.children("id").first().text()) ??
    url ??
    buildFallbackExternalId([title, excerpt, publishedAt?.toISOString() ?? null]);

  if (!title || !externalId || !plainText) {
    return null;
  }

  return {
    externalId,
    url,
    title,
    categories,
    author,
    publishedAt,
    contentHtml: contentHtml ? normalizeContentHtml(contentHtml) : null,
    plainText,
    excerpt,
  };
}

function detectFeedKind(body: string, contentType: string | null) {
  if (FEED_CONTENT_TYPE_PATTERNS.test(contentType ?? "")) {
    if (/<feed[\s>]/i.test(body)) {
      return "atom" as const;
    }

    return "rss" as const;
  }

  if (/<rss[\s>]/i.test(body) || /<channel[\s>]/i.test(body) || /<rdf:RDF[\s>]/i.test(body)) {
    return "rss" as const;
  }

  if (/<feed[\s>]/i.test(body) && /<entry[\s>]/i.test(body)) {
    return "atom" as const;
  }

  return null;
}

function resolveUrl(value: string | null, baseUrl: string) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return null;
  }
}

function safeParseUrl(value: string) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function normalizeSiteUrl(value: string | null) {
  if (!value) {
    return null;
  }

  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function cleanText(value: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function extractRssCategories($: ReturnType<typeof load>, item: Parameters<ReturnType<typeof load>>[0]) {
  const $item = $(item);
  return dedupeCategories(
    $item
      .children("category")
      .toArray()
      .map((element) => cleanText($(element).text()))
      .filter((value): value is string => Boolean(value)),
  );
}

function extractAtomCategories($: ReturnType<typeof load>, entry: Parameters<ReturnType<typeof load>>[0]) {
  const $entry = $(entry);
  return dedupeCategories(
    $entry
      .children("category")
      .toArray()
      .map((element) => cleanText($(element).attr("term") ?? $(element).text()))
      .filter((value): value is string => Boolean(value)),
  );
}

function dedupeCategories(values: string[]) {
  const seen = new Set<string>();
  const categories: string[] = [];

  for (const value of values) {
    const normalized = normalizeCategoryLabel(value);
    if (!normalized || seen.has(normalized.toLowerCase())) {
      continue;
    }

    seen.add(normalized.toLowerCase());
    categories.push(normalized);
  }

  return categories;
}

function normalizeCategoryLabel(value: string) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized || null;
}

function parseDate(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeContentHtml(value: string) {
  return value.trim() || null;
}

function htmlToPlainText(html: string | null) {
  if (!html) {
    return "";
  }

  return load(`<body>${html}</body>`).text().replace(/\s+/g, " ").trim();
}

function buildExcerpt(plainText: string) {
  if (!plainText) {
    return "";
  }

  return plainText.length > 220 ? `${plainText.slice(0, 220).trim()}…` : plainText;
}

function buildFallbackExternalId(parts: Array<string | null>) {
  const normalized = parts.filter((part): part is string => Boolean(part)).join("|");
  return createHash("sha1").update(normalized).digest("hex");
}
