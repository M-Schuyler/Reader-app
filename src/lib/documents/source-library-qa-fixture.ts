import {
  AiSummaryStatus,
  DocumentType,
  IngestionStatus,
  PublishedAtKind,
  ReadState,
} from "@prisma/client";
import type { DocumentListItem, GetDocumentsResponseData } from "@/server/modules/documents/document.types";

export function getSourceLibraryQaFixture(): GetDocumentsResponseData {
  const now = new Date();
  const recent = isoHoursAgo(now, 6);
  const recentEarlier = isoHoursAgo(now, 10);
  const recentFailed = isoHoursAgo(now, 14);
  const thisWeek = isoDaysAgo(now, 3);
  const older = isoDaysAgo(now, 16);

  return {
    items: [
      createListItem({
        id: "qa-source-feed-1-short",
        title: "多数人都不配有钱",
        aiSummary: "财富不是只靠判断力积累的，它也依赖纪律、结构和长期约束。",
        canonicalUrl: "https://mp.weixin.qq.com/s/short-title-demo",
        sourceUrl: "https://mp.weixin.qq.com/s/short-title-demo",
        createdAt: recent,
        updatedAt: recent,
        publishedAt: recent,
        wordCount: 1123,
        feed: {
          id: "feed-kai-money",
          title: "Kai Dispatch",
        },
      }),
      createListItem({
        id: "qa-source-feed-1-long",
        title: "Claude能直接操控你的电脑微信了，这才是真正的上位小龙虾。",
        aiSummary:
          "这篇内容更长，专门用来检查来源库里左侧封面是否还会被正文高度拖着一起变形。",
        canonicalUrl: "https://mp.weixin.qq.com/s/very-long-title-demo",
        sourceUrl: "https://mp.weixin.qq.com/s/very-long-title-demo",
        createdAt: recentEarlier,
        updatedAt: recentEarlier,
        publishedAt: recentEarlier,
        wordCount: 3348,
        feed: {
          id: "feed-kai-money",
          title: "Kai Dispatch",
        },
      }),
      createListItem({
        id: "qa-source-failed",
        title: "抓取失败的网页也要留在架上",
        aiSummary: null,
        excerpt: "这一段不应该在 FAILED 状态下显示出来。",
        canonicalUrl: "https://example.com/failed-story",
        sourceUrl: "https://example.com/failed-story",
        createdAt: recentFailed,
        updatedAt: recentFailed,
        publishedAt: recentFailed,
        wordCount: null,
        ingestionStatus: IngestionStatus.FAILED,
        feed: null,
      }),
      createListItem({
        id: "qa-source-week",
        title: "为什么好产品不该把搜索做成命令行",
        aiSummary: "用一条普通网页来源，看看退回域名分组时的一级卡片长什么样。",
        canonicalUrl: "https://sspai.com/post/98765",
        sourceUrl: "https://sspai.com/post/98765",
        createdAt: thisWeek,
        updatedAt: thisWeek,
        publishedAt: thisWeek,
        wordCount: 1890,
        feed: null,
      }),
      createListItem({
        id: "qa-source-older",
        title: "更早收入库的内容应该退到后排，但不该消失",
        aiSummary: "这一条用来稳定展示“更早”书架，避免 QA 页只看到最近内容。",
        canonicalUrl: "https://archive.example.com/library/older-story",
        sourceUrl: "https://archive.example.com/library/older-story",
        createdAt: older,
        updatedAt: older,
        publishedAt: older,
        wordCount: 2048,
        feed: {
          id: "feed-archive",
          title: "Archive Notes",
        },
      }),
    ],
    pagination: {
      page: 1,
      pageSize: 20,
      total: 5,
      totalPages: 1,
    },
    filters: {
      surface: "source",
      sort: "latest",
    },
  };
}

function createListItem(overrides: Partial<DocumentListItem>): DocumentListItem {
  return {
    id: "qa-document",
    type: DocumentType.WEB_PAGE,
    title: "来源库 QA 示例",
    sourceUrl: "https://example.com/story",
    canonicalUrl: "https://example.com/story",
    aiSummary: null,
    aiSummaryStatus: AiSummaryStatus.READY,
    aiSummaryError: null,
    excerpt: "默认摘要",
    lang: "zh",
    publishedAt: new Date().toISOString(),
    publishedAtKind: PublishedAtKind.EXACT,
    enteredReadingAt: null,
    readState: ReadState.UNREAD,
    isFavorite: false,
    ingestionStatus: IngestionStatus.READY,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    wordCount: 1200,
    feed: null,
    ...overrides,
  };
}

function isoHoursAgo(now: Date, hours: number) {
  return new Date(now.getTime() - hours * 60 * 60 * 1000).toISOString();
}

function isoDaysAgo(now: Date, days: number) {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}
