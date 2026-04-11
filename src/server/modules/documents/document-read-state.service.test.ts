import assert from "node:assert/strict";
import test from "node:test";
import { AiSummaryStatus, DocumentType, IngestionStatus, PublishedAtKind, ReadState } from "@prisma/client";
import {
  parseUpdateDocumentReadStateInput,
  updateDocumentReadState,
} from "./document.service";
import type { DocumentDetailRecord } from "./document.repository";

function createDocumentRecord(overrides: Partial<DocumentDetailRecord> = {}): DocumentDetailRecord {
  const base = {
    id: "doc_read_state",
    type: DocumentType.WEB_PAGE,
    title: "Reader 已读测试",
    sourceUrl: "https://reader.test/article",
    sourceId: null,
    canonicalUrl: "https://reader.test/article",
    externalId: null,
    aiSummary: null,
    aiSummaryStatus: AiSummaryStatus.READY,
    aiSummaryError: null,
    excerpt: null,
    lang: "zh-CN",
    author: null,
    publishedAt: null,
    publishedAtKind: PublishedAtKind.UNKNOWN,
    enteredReadingAt: new Date("2026-04-09T08:00:00.000Z"),
    readState: ReadState.UNREAD,
    isFavorite: false,
    ingestionStatus: IngestionStatus.READY,
    feedId: null,
    createdAt: new Date("2026-04-09T08:00:00.000Z"),
    updatedAt: new Date("2026-04-09T08:00:00.000Z"),
    source: null,
    feed: null,
    file: null,
    content: {
      contentHtml: "<p>正文</p>",
      plainText: "正文",
      rawHtml: null,
      textHash: "hash",
      wordCount: 2,
      extractedAt: new Date("2026-04-09T08:00:00.000Z"),
    },
    tags: [],
  } as unknown as DocumentDetailRecord;

  return {
    ...base,
    ...overrides,
    source: overrides.source === undefined ? base.source : overrides.source,
    feed: overrides.feed === undefined ? base.feed : overrides.feed,
    file: overrides.file === undefined ? base.file : overrides.file,
    content: overrides.content === undefined ? base.content : overrides.content,
    tags: overrides.tags === undefined ? base.tags : overrides.tags,
  };
}

test("parseUpdateDocumentReadStateInput only accepts READ", () => {
  assert.deepEqual(parseUpdateDocumentReadStateInput({ readState: ReadState.READ }), {
    readState: ReadState.READ,
  });

  assert.throws(() => parseUpdateDocumentReadStateInput(null), /JSON object/i);
  assert.throws(() => parseUpdateDocumentReadStateInput([]), /JSON object/i);
  assert.throws(() => parseUpdateDocumentReadStateInput({}), /READ/i);
  assert.throws(() => parseUpdateDocumentReadStateInput({ readState: ReadState.UNREAD }), /READ/i);
  assert.throws(() => parseUpdateDocumentReadStateInput({ readState: ReadState.READING }), /READ/i);
});

test("updateDocumentReadState marks unread and reading documents as READ", async () => {
  const unreadRecord = createDocumentRecord({
    id: "doc_unread",
    readState: ReadState.UNREAD,
  });
  const readRecord = createDocumentRecord({
    id: "doc_unread",
    readState: ReadState.READ,
  });
  let markCalls = 0;
  let getCalls = 0;

  const response = await updateDocumentReadState(
    "doc_unread",
    { readState: ReadState.READ },
    {
      getDocumentById: async () => {
        getCalls += 1;
        return getCalls === 1 ? unreadRecord : readRecord;
      },
      markDocumentRead: async () => {
        markCalls += 1;
        return readRecord;
      },
      listWechatSubsourcesByBiz: async () => [],
    },
  );

  assert.equal(markCalls, 1);
  assert.equal(response?.document.readState, ReadState.READ);
});

test("updateDocumentReadState is idempotent for already-read documents", async () => {
  const readRecord = createDocumentRecord({
    id: "doc_read",
    readState: ReadState.READ,
  });
  let markCalls = 0;

  const response = await updateDocumentReadState(
    "doc_read",
    { readState: ReadState.READ },
    {
      getDocumentById: async () => readRecord,
      markDocumentRead: async () => {
        markCalls += 1;
        return readRecord;
      },
      listWechatSubsourcesByBiz: async () => [],
    },
  );

  assert.equal(markCalls, 0);
  assert.equal(response?.document.readState, ReadState.READ);
});

test("updateDocumentReadState returns null when the document does not exist", async () => {
  const response = await updateDocumentReadState(
    "doc_missing",
    { readState: ReadState.READ },
    {
      getDocumentById: async () => null,
      markDocumentRead: async () => {
        throw new Error("should not write missing documents");
      },
      listWechatSubsourcesByBiz: async () => [],
    },
  );

  assert.equal(response, null);
});
