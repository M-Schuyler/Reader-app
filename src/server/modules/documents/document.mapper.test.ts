import assert from "node:assert/strict";
import test from "node:test";
import { DocumentType, IngestionStatus, PublishedAtKind, ReadState } from "@prisma/client";
import { mapDocumentDetail } from "./document.mapper";
import type { DocumentDetailRecord } from "./document.repository";

function createDocumentDetailRecord(overrides: Partial<DocumentDetailRecord> = {}): DocumentDetailRecord {
  const now = new Date("2026-04-12T05:00:00.000Z");

  return {
    id: "doc-video-1",
    type: DocumentType.WEB_PAGE,
    title: "Video doc",
    sourceUrl: "https://youtu.be/VIIIP_uNGSU",
    canonicalUrl: "https://www.youtube.com/watch?v=VIIIP_uNGSU",
    videoUrl: "https://www.youtube.com/watch?v=VIIIP_uNGSU",
    videoProvider: "youtube",
    videoThumbnailUrl: "https://i.ytimg.com/vi/VIIIP_uNGSU/maxresdefault.jpg",
    videoDurationSeconds: 120,
    transcriptSegments: [
      { start: 0, end: 2, text: "hello" },
      { start: 2, end: 4, text: "world" },
    ],
    externalId: "youtube:VIIIP_uNGSU",
    aiSummary: null,
    aiSummaryStatus: null,
    aiSummaryError: null,
    excerpt: "hello world",
    lang: "en",
    author: "Channel",
    contentOriginKey: null,
    contentOriginLabel: null,
    publishedAt: null,
    publishedAtKind: PublishedAtKind.UNKNOWN,
    enteredReadingAt: null,
    readState: ReadState.UNREAD,
    isFavorite: false,
    ingestionStatus: IngestionStatus.READY,
    sourceId: null,
    feedId: null,
    createdAt: now,
    updatedAt: now,
    source: null,
    feed: null,
    file: null,
    tags: [],
    content: {
      contentHtml: null,
      plainText: "hello\nworld",
      rawHtml: null,
      textHash: "hash",
      wordCount: 2,
      extractedAt: now,
    },
    ...overrides,
  } as DocumentDetailRecord;
}

test("mapDocumentDetail keeps persisted video fields and builds video embed payload", () => {
  const mapped = mapDocumentDetail(createDocumentDetailRecord());

  assert.equal(mapped.videoUrl, "https://www.youtube.com/watch?v=VIIIP_uNGSU");
  assert.equal(mapped.videoProvider, "youtube");
  assert.equal(mapped.videoThumbnailUrl, "https://i.ytimg.com/vi/VIIIP_uNGSU/maxresdefault.jpg");
  assert.equal(mapped.videoDurationSeconds, 120);
  assert.equal(mapped.videoEmbed?.provider, "youtube");
  assert.equal(mapped.videoEmbed?.syncMode, "full");
  assert.deepEqual(mapped.videoEmbed?.segments, [
    { start: 0, end: 2, text: "hello" },
    { start: 2, end: 4, text: "world" },
  ]);
});

test("mapDocumentDetail withholds Gemini-generated transcript text from the video embed payload", () => {
  const mapped = mapDocumentDetail(
    createDocumentDetailRecord({
      transcriptSource: "GEMINI",
      transcriptStatus: "READY",
      transcriptSegments: [
        { start: 0, end: 2, text: "hallucinated subtitle one" },
        { start: 2, end: 4, text: "hallucinated subtitle two" },
      ],
    }),
  );

  assert.deepEqual(mapped.videoEmbed?.segments, []);
  assert.equal(mapped.videoEmbed?.transcriptSource, "NONE");
  assert.equal(mapped.videoEmbed?.transcriptStatus, "FAILED");
});
