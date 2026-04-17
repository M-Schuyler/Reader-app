import assert from "node:assert/strict";
import test from "node:test";
import { AiSummaryStatus, DocumentType, IngestionStatus, PublishedAtKind, ReadState } from "@prisma/client";
import { buildContentOriginIndex } from "@/lib/documents/content-origin";
import { getDocument, openDocument, openReaderDocument } from "@/server/modules/documents/document.service";
import type { DocumentDetailRecord, DocumentReaderRecord } from "@/server/modules/documents/document.repository";
import type { CaptureIngestionError } from "@/server/modules/documents/document.types";

function createDocumentRecord(overrides: Partial<DocumentDetailRecord> = {}): DocumentDetailRecord {
  const base = {
    id: "doc_failed",
    type: DocumentType.WEB_PAGE,
    title: "验证失败文档",
    sourceUrl: "https://mp.weixin.qq.com/s/example",
    sourceId: null,
    canonicalUrl: "https://mp.weixin.qq.com/s/example",
    externalId: null,
    aiSummary: null,
    aiSummaryStatus: AiSummaryStatus.READY,
    aiSummaryError: null,
    excerpt: null,
    lang: "zh-CN",
    author: null,
    publishedAt: null,
    publishedAtKind: PublishedAtKind.UNKNOWN,
    enteredReadingAt: null,
    readState: ReadState.UNREAD,
    isFavorite: false,
    ingestionStatus: IngestionStatus.FAILED,
    feedId: null,
    createdAt: new Date("2026-04-09T08:00:00.000Z"),
    updatedAt: new Date("2026-04-09T08:00:00.000Z"),
    source: null,
    feed: null,
    file: null,
    content: null,
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

function createReaderDocumentRecord(overrides: Partial<DocumentReaderRecord> = {}): DocumentReaderRecord {
  const base = {
    id: "reader_doc",
    type: DocumentType.WEB_PAGE,
    title: "视频阅读页",
    sourceUrl: "https://youtu.be/svquts376lo",
    canonicalUrl: "https://www.youtube.com/watch?v=svquts376lo",
    videoUrl: "https://www.youtube.com/watch?v=svquts376lo",
    videoProvider: "youtube",
    videoDurationSeconds: 80,
    transcriptSegments: [
      {
        start: 0,
        end: 3.4,
        text: "Hi there! Welcome back to another video.",
      },
    ],
    transcriptSource: "GEMINI",
    transcriptStatus: "READY",
    aiSummary: null,
    aiSummaryStatus: AiSummaryStatus.READY,
    aiSummaryError: null,
    excerpt: null,
    author: "Volka English",
    contentOriginLabel: null,
    publishedAt: null,
    publishedAtKind: PublishedAtKind.UNKNOWN,
    enteredReadingAt: new Date("2026-04-17T00:00:00.000Z"),
    readState: ReadState.UNREAD,
    readingProgress: 0,
    isFavorite: false,
    ingestionStatus: IngestionStatus.READY,
    content: {
      contentHtml: null,
      wordCount: 18,
    },
  } as unknown as DocumentReaderRecord;

  return {
    ...base,
    ...overrides,
    content: overrides.content === undefined ? base.content : overrides.content,
  };
}

test("openDocument includes the latest capture ingestion error for failed documents", async () => {
  const documentRecord = createDocumentRecord();
  const ingestionError: CaptureIngestionError = {
    code: "SOURCE_VERIFICATION_REQUIRED",
    message: "来源站点触发验证或环境异常，当前无法稳定抓取正文。",
  };

  let getDocumentCalls = 0;
  let markCalls = 0;

  const data = await openDocument("doc_failed", {
    getDocumentById: async () => {
      getDocumentCalls += 1;
      return documentRecord;
    },
    markDocumentEnteredReading: async () => {
      markCalls += 1;
      return { count: 1 };
    },
    getLatestCaptureError: async () => ingestionError,
  });

  assert.equal(getDocumentCalls, 2);
  assert.equal(markCalls, 1);
  assert.ok(data?.document.ingestion);
  assert.deepEqual(data.document.ingestion.error, ingestionError);
});

test("openDocument maps persisted content origin metadata into the reader document payload", async () => {
  const documentRecord = createDocumentRecord({
    author: "不会直接显示的作者",
  }) as DocumentDetailRecord & {
    contentOriginKey: string;
    contentOriginLabel: string;
  };

  documentRecord.contentOriginKey = "wechat:biz:MzI0MDg5ODA2NQ==";
  documentRecord.contentOriginLabel = "蔡垒磊";

  const data = await openDocument("doc_failed", {
    getDocumentById: async () => documentRecord,
    markDocumentEnteredReading: async () => ({ count: 1 }),
    getLatestCaptureError: async () => null,
    listWechatSubsourcesByBiz: async () => [
      {
        biz: "MzI0MDg5ODA2NQ==",
        displayName: "请辩",
        isPlaceholder: false,
        createdAt: new Date("2026-04-10T00:00:00.000Z"),
        updatedAt: new Date("2026-04-10T00:00:00.000Z"),
      },
    ],
  });

  assert.deepEqual(data?.document.contentOrigin, {
    key: "wechat:biz:MzI0MDg5ODA2NQ==",
    label: "请辩",
  });
});

test("getDocument falls back to the persisted wechat biz label when the registry has no match", async () => {
  const documentRecord = createDocumentRecord({
    author: "不会直接显示的作者",
  }) as DocumentDetailRecord & {
    contentOriginKey: string;
    contentOriginLabel: string;
  };

  documentRecord.contentOriginKey = "wechat:biz:MzI0MDg5ODA2NQ==";
  documentRecord.contentOriginLabel = "请辩";

  const data = await getDocument("doc_failed", {
    getDocumentById: async () => documentRecord,
    getLatestCaptureError: async () => null,
    listWechatSubsourcesByBiz: async () => [],
  });

  assert.deepEqual(data?.document.contentOrigin, {
    key: "wechat:biz:MzI0MDg5ODA2NQ==",
    label: "请辩",
  });
});

test("getDocument keeps pre-backfill wechat detail content-origin aligned with list-side derivation", async () => {
  const documentRecord = createDocumentRecord({
    author: "蔡垒磊",
    canonicalUrl: "https://mp.weixin.qq.com/s?__biz=MzI0MDg5ODA2NQ==&mid=1&idx=1&sn=abc",
    sourceUrl: "https://mp.weixin.qq.com/s/u5b-5ihEDEIFvykN_HDZig",
    content: {
      contentHtml: null,
      plainText: "正文",
      rawHtml: "<script>var profile_nickname = \"请辩\";</script>",
      textHash: "hash",
      wordCount: 12,
      extractedAt: new Date("2026-04-09T08:00:00.000Z"),
    },
  } as unknown as Partial<DocumentDetailRecord>) as DocumentDetailRecord & {
    contentOriginKey: null;
    contentOriginLabel: null;
  };

  documentRecord.contentOriginKey = null;
  documentRecord.contentOriginLabel = null;

  const listSide = buildContentOriginIndex([
    {
      id: documentRecord.id,
      author: documentRecord.author,
      sourceUrl: documentRecord.sourceUrl,
      canonicalUrl: documentRecord.canonicalUrl,
      contentOriginKey: documentRecord.contentOriginKey,
      contentOriginLabel: documentRecord.contentOriginLabel,
      rawHtml: documentRecord.content?.rawHtml ?? null,
    },
  ]);

  const data = await getDocument("doc_failed", {
    getDocumentById: async () => documentRecord,
    getLatestCaptureError: async () => null,
    listWechatSubsourcesByBiz: async () => [],
  });

  assert.deepEqual(data?.document.contentOrigin, {
    key: "wechat:biz:MzI0MDg5ODA2NQ==",
    label: "请辩",
  });
  assert.deepEqual(data?.document.contentOrigin, {
    key: listSide.options[0]?.value ?? null,
    label: listSide.options[0]?.label ?? null,
  });
});

test("openReaderDocument keeps transcript segments for video documents", async () => {
  const readerRecord = createReaderDocumentRecord();

  const data = await openReaderDocument(readerRecord.id, {
    dependencies: {
      getReaderDocumentById: async () => readerRecord,
      getReaderNextDocument: async () => null,
      markDocumentEnteredReading: async () => ({ count: 1 }),
    },
  });

  assert.equal(data?.document.videoEmbed?.segments.length, 1);
  assert.equal(data?.document.videoEmbed?.segments[0]?.text, "Hi there! Welcome back to another video.");
  assert.equal(data?.document.transcriptStatus, "READY");
});
