import assert from "node:assert/strict";
import test from "node:test";

import { normalizeVideoProvider, resolveDocumentVideoEmbed, resolveVideoIdentityFromUrl } from "./video-embed";

test("resolveDocumentVideoEmbed resolves youtu.be links", () => {
  const embed = resolveDocumentVideoEmbed({
    videoProvider: null,
    videoUrl: null,
    canonicalUrl: null,
    sourceUrl: "https://youtu.be/VIIIP_uNGSU",
  });

  assert.deepEqual(embed, {
    provider: "youtube",
    embedUrl: "https://www.youtube.com/embed/VIIIP_uNGSU?enablejsapi=1&playsinline=1&rel=0",
    segments: [],
    syncMode: "full",
  });
});

test("resolveDocumentVideoEmbed resolves youtube watch links and keeps start offset", () => {
  const embed = resolveDocumentVideoEmbed({
    videoProvider: null,
    videoUrl: null,
    canonicalUrl: "https://www.youtube.com/watch?v=VIIIP_uNGSU&t=1m2s",
    sourceUrl: null,
  });

  assert.deepEqual(embed, {
    provider: "youtube",
    embedUrl: "https://www.youtube.com/embed/VIIIP_uNGSU?enablejsapi=1&playsinline=1&rel=0&start=62",
    segments: [],
    syncMode: "full",
  });
});

test("resolveDocumentVideoEmbed ignores non-video links", () => {
  const embed = resolveDocumentVideoEmbed({
    videoProvider: null,
    videoUrl: null,
    canonicalUrl: "https://example.com/articles/foo",
    sourceUrl: null,
  });

  assert.equal(embed, null);
});

test("resolveDocumentVideoEmbed ignores invalid youtube ids", () => {
  const embed = resolveDocumentVideoEmbed({
    videoProvider: "youtube",
    videoUrl: "https://www.youtube.com/watch?v=../../etc/passwd",
    canonicalUrl: "https://www.youtube.com/watch?v=../../etc/passwd",
    sourceUrl: null,
  });

  assert.equal(embed, null);
});

test("resolveDocumentVideoEmbed resolves bilibili links with manual sync mode", () => {
  const embed = resolveDocumentVideoEmbed({
    videoProvider: "bilibili",
    videoUrl: "https://www.bilibili.com/video/BV1xx411c7mD/",
    canonicalUrl: null,
    sourceUrl: null,
    transcriptSegments: [
      { start: 0, end: 2.5, text: "第一段" },
      { start: 2.5, end: 7.1, text: "第二段" },
    ],
  });

  assert.deepEqual(embed, {
    provider: "bilibili",
    embedUrl: "https://player.bilibili.com/player.html?bvid=BV1xx411c7mD&page=1&high_quality=1",
    segments: [
      { start: 0, end: 2.5, text: "第一段" },
      { start: 2.5, end: 7.1, text: "第二段" },
    ],
    syncMode: "manual",
  });
});

test("resolveVideoIdentityFromUrl parses youtube and bilibili identifiers", () => {
  assert.deepEqual(resolveVideoIdentityFromUrl("https://youtu.be/VIIIP_uNGSU"), {
    provider: "youtube",
    id: "VIIIP_uNGSU",
    startSeconds: null,
  });

  assert.deepEqual(resolveVideoIdentityFromUrl("https://www.bilibili.com/video/BV1xx411c7mD"), {
    provider: "bilibili",
    id: "BV1xx411c7mD",
    startSeconds: null,
  });
});

test("normalizeVideoProvider only accepts supported providers", () => {
  assert.equal(normalizeVideoProvider("youtube"), "youtube");
  assert.equal(normalizeVideoProvider("BILIBILI"), "bilibili");
  assert.equal(normalizeVideoProvider("vimeo"), null);
});
