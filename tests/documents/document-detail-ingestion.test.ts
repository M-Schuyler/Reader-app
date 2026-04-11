import assert from "node:assert/strict";
import test from "node:test";
import { AiSummaryStatus, DocumentType, IngestionStatus, PublishedAtKind, ReadState } from "@prisma/client";
import { openDocument } from "@/server/modules/documents/document.service";
import type { DocumentDetailRecord } from "@/server/modules/documents/document.repository";
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
