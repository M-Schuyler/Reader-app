import assert from "node:assert/strict";
import test from "node:test";
import {
  discoverFeedFromResponse,
  parseFeedDocument,
} from "@/server/modules/sources/source-rss";

test("discoverFeedFromResponse returns the feed itself when the response is rss xml", () => {
  const result = discoverFeedFromResponse({
    requestUrl: "https://example.com/feed.xml",
    responseUrl: "https://example.com/feed.xml",
    contentType: "application/rss+xml; charset=utf-8",
    body: `<?xml version="1.0"?>
      <rss version="2.0">
        <channel>
          <title>Example Feed</title>
          <link>https://example.com</link>
        </channel>
      </rss>`,
  });

  assert.equal(result.feedUrl, "https://example.com/feed.xml");
  assert.equal(result.siteUrl, "https://example.com");
  assert.equal(result.kind, "rss");
});

test("discoverFeedFromResponse finds rss links from an html page", () => {
  const result = discoverFeedFromResponse({
    requestUrl: "https://example.com",
    responseUrl: "https://example.com/articles",
    contentType: "text/html; charset=utf-8",
    body: `
      <html>
        <head>
          <link rel="alternate" type="application/rss+xml" title="RSS" href="/feed.xml" />
        </head>
      </html>
    `,
  });

  assert.equal(result.feedUrl, "https://example.com/feed.xml");
  assert.equal(result.siteUrl, "https://example.com/articles");
  assert.equal(result.kind, "rss");
});

test("parseFeedDocument extracts rss items with stable fallback ids", () => {
  const parsed = parseFeedDocument({
    feedUrl: "https://example.com/feed.xml",
    xml: `<?xml version="1.0"?>
      <rss version="2.0">
        <channel>
          <title>Example Feed</title>
          <link>https://example.com</link>
          <language>zh-CN</language>
          <item>
            <title>First post</title>
            <link>https://example.com/posts/1</link>
            <category>Tech</category>
            <category>Reviews</category>
            <description><![CDATA[<p>Hello world</p>]]></description>
            <pubDate>Fri, 28 Mar 2026 08:30:00 GMT</pubDate>
          </item>
        </channel>
      </rss>`,
  });

  assert.equal(parsed.title, "Example Feed");
  assert.equal(parsed.siteUrl, "https://example.com");
  assert.equal(parsed.entries.length, 1);
  assert.equal(parsed.entries[0]?.externalId, "https://example.com/posts/1");
  assert.equal(parsed.entries[0]?.dedupeUrl, "https://example.com/posts/1");
  assert.equal(parsed.entries[0]?.url, "https://example.com/posts/1");
  assert.equal(parsed.entries[0]?.title, "First post");
  assert.deepEqual(parsed.entries[0]?.categories, ["Tech", "Reviews"]);
  assert.ok(parsed.entries[0]?.textHash);
  assert.match(parsed.entries[0]?.contentHtml ?? "", /Hello world/);
});

test("parseFeedDocument extracts atom entries and preserves summary html", () => {
  const parsed = parseFeedDocument({
    feedUrl: "https://example.com/atom.xml",
    xml: `<?xml version="1.0" encoding="utf-8"?>
      <feed xmlns="http://www.w3.org/2005/Atom" xml:lang="zh-CN">
        <title>Atom Feed</title>
        <link rel="alternate" href="https://example.com" />
        <entry>
          <id>tag:example.com,2026:post-1</id>
          <title>Atom Post</title>
          <link href="https://example.com/atom-post" />
          <category term="Tech" />
          <category term="Reviews" />
          <updated>2026-03-28T08:30:00Z</updated>
          <summary type="html">&lt;p&gt;Atom summary&lt;/p&gt;</summary>
        </entry>
      </feed>`,
  });

  assert.equal(parsed.title, "Atom Feed");
  assert.equal(parsed.siteUrl, "https://example.com");
  assert.equal(parsed.entries.length, 1);
  assert.equal(parsed.entries[0]?.externalId, "tag:example.com,2026:post-1");
  assert.equal(parsed.entries[0]?.dedupeUrl, "https://example.com/atom-post");
  assert.equal(parsed.entries[0]?.url, "https://example.com/atom-post");
  assert.deepEqual(parsed.entries[0]?.categories, ["Tech", "Reviews"]);
  assert.ok(parsed.entries[0]?.textHash);
  assert.match(parsed.entries[0]?.contentHtml ?? "", /Atom summary/);
});

test("parseFeedDocument normalizes guid-like urls for dedupeUrl", () => {
  const parsed = parseFeedDocument({
    feedUrl: "https://example.com/feed.xml",
    xml: `<?xml version="1.0"?>
      <rss version="2.0">
        <channel>
          <title>Example Feed</title>
          <item>
            <title>Guid fallback post</title>
            <guid>https://example.com/posts/42</guid>
            <description><![CDATA[<p>Guid body</p>]]></description>
          </item>
        </channel>
      </rss>`,
  });

  assert.equal(parsed.entries.length, 1);
  assert.equal(parsed.entries[0]?.externalId, "https://example.com/posts/42");
  assert.equal(parsed.entries[0]?.dedupeUrl, "https://example.com/posts/42");
  assert.ok(parsed.entries[0]?.textHash);
});
