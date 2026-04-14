import test from "node:test";
import assert from "node:assert/strict";
import { AiSummaryStatus, DocumentType, IngestionStatus, ReadState } from "@prisma/client";
import type { HighlightRecord } from "@/server/modules/highlights/highlight.types";
import type { DocumentDetail } from "@/server/modules/documents/document.types";
import {
  isQaRealDocumentId,
  isQaRealHighlightId,
  mapQaRealDocument,
  mapQaRealHighlight,
  parseQaRealDocumentId,
  parseQaRealHighlightId,
  toQaRealDocumentId,
  toQaRealHighlightId,
} from "./qa-real-document";

test("real document QA ids round-trip without colliding with fixture ids", () => {
  const actualId = "cmn8dcaze0001lugwsv7kkzsp";
  const qaId = toQaRealDocumentId(actualId);

  assert.equal(isQaRealDocumentId(qaId), true);
  assert.equal(parseQaRealDocumentId(qaId), actualId);
  assert.equal(isQaRealDocumentId("qa-highlights-document"), false);
});

test("real highlight QA ids round-trip without colliding with fixture ids", () => {
  const actualId = "cmn8highlight0001lugwsv7kk";
  const qaId = toQaRealHighlightId(actualId);

  assert.equal(isQaRealHighlightId(qaId), true);
  assert.equal(parseQaRealHighlightId(qaId), actualId);
  assert.equal(isQaRealHighlightId("qa-highlight-fixture"), false);
});

test("mapping a QA real document only rewrites the public id", () => {
  const document: DocumentDetail = {
    id: "cmn8dcaze0001lugwsv7kkzsp",
    type: DocumentType.WEB_PAGE,
    title: "Real document",
    sourceUrl: "https://example.com/article",
    canonicalUrl: "https://example.com/article",
    videoUrl: null,
    videoProvider: null,
    videoThumbnailUrl: null,
    videoDurationSeconds: null,
    videoEmbed: null,
    aiSummary: "Summary",
    aiSummaryStatus: AiSummaryStatus.READY,
    aiSummaryError: null,
    excerpt: "Excerpt",
    lang: "en",
    author: "Author",
    contentOrigin: null,
    publishedAt: "2026-03-27T10:00:00.000Z",
    publishedAtKind: "EXACT",
    enteredReadingAt: "2026-03-27T10:10:00.000Z",
    readState: ReadState.UNREAD,
    isFavorite: false,
    ingestionStatus: IngestionStatus.READY,
    createdAt: "2026-03-27T10:00:00.000Z",
    updatedAt: "2026-03-27T10:00:00.000Z",
    tags: [],
    source: null,
    feed: null,
    file: null,
    content: {
      contentHtml: "<p>Hello</p>",
      plainText: "Hello",
      wordCount: 1,
      extractedAt: "2026-03-27T10:00:00.000Z",
    },
  };

  const mapped = mapQaRealDocument(document);

  assert.equal(mapped.id, toQaRealDocumentId(document.id));
  assert.equal(mapped.title, document.title);
  assert.equal(mapped.content?.plainText, document.content?.plainText);
});

test("mapping a QA real highlight rewrites both id and documentId for the QA route surface", () => {
  const highlight: HighlightRecord = {
    id: "cmn8highlight0001lugwsv7kk",
    documentId: "cmn8dcaze0001lugwsv7kkzsp",
    quoteText: "Important line",
    note: "Note",
    color: null,
    startOffset: 10,
    endOffset: 24,
    selectorJson: null,
    createdAt: "2026-03-27T10:00:00.000Z",
    updatedAt: "2026-03-27T10:00:00.000Z",
  };

  const mapped = mapQaRealHighlight(highlight);

  assert.equal(mapped.id, toQaRealHighlightId(highlight.id));
  assert.equal(mapped.documentId, toQaRealDocumentId(highlight.documentId));
  assert.equal(mapped.quoteText, highlight.quoteText);
});
