import assert from "node:assert/strict";
import test from "node:test";
import { IngestionStatus, PublishedAtKind } from "@prisma/client";
import { RouteError } from "@/server/api/response";
import {
  hydrateWechatArchiveDocument,
  importWechatArchiveCatalog,
  isWechatArchiveMarkdownFile,
  parseWechatArchiveMarkdown,
} from "@/server/modules/imports/wechat-archive";

const archivePath = "/archive/请辩/md/为什么要建立财富.md";
const archiveMarkdown = `
为什么要建立财富
========

原创 蔡垒磊 请辩 2023-05-12 08:30 浙江

> 原文地址: [https://mp.weixin.qq.com/s/example-id](https://mp.weixin.qq.com/s/example-id)

——————————————

第一段正文。

第二段正文。
`;

test("parseWechatArchiveMarkdown reads the archived article header and separates the body", () => {
  const parsed = parseWechatArchiveMarkdown(archiveMarkdown, archivePath);

  assert.equal(parsed.title, "为什么要建立财富");
  assert.equal(parsed.sourceUrl, "https://mp.weixin.qq.com/s/example-id");
  assert.equal(parsed.accountName, "请辩");
  assert.equal(parsed.author, "蔡垒磊");
  assert.equal(parsed.publishedAt?.toISOString(), "2023-05-12T00:30:00.000Z");
  assert.equal(parsed.bodyMarkdown, "第一段正文。\n\n第二段正文。");
});

test("archive discovery excludes Reader-generated Obsidian exports", () => {
  assert.equal(isWechatArchiveMarkdownFile("原始文章.md"), true);
  assert.equal(isWechatArchiveMarkdownFile("原始文章.obsidian.md"), false);
});

test("importWechatArchiveCatalog creates one metadata-only catalog entry for duplicate archive URLs", async () => {
  const createdInputs: Array<Record<string, unknown>> = [];
  const documentsByDedupeKey = new Map<string, { id: string }>();

  const result = await importWechatArchiveCatalog(
    { rootPath: "/archive" },
    {
      listArchivePaths: async () => [archivePath, "/archive/请辩/md/同一篇文章.md"],
      readFile: async () => archiveMarkdown,
      findDocumentByDedupeKey: async (dedupeKey) => documentsByDedupeKey.get(dedupeKey) ?? null,
      createWebDocumentPlaceholder: async (input) => {
        createdInputs.push(input);
        const created = { id: "catalog_doc" };
        documentsByDedupeKey.set(String(input.dedupeKey), created);
        return created as never;
      },
      syncWechatSubsource: async () => null,
    },
  );

  assert.deepEqual(result, {
    scanned: 2,
    created: 1,
    skipped: 1,
    failed: 0,
    failures: [],
  });
  assert.equal(createdInputs.length, 1);
  assert.deepEqual(createdInputs[0], {
    title: "为什么要建立财富",
    sourceUrl: "https://mp.weixin.qq.com/s/example-id",
    canonicalUrl: "https://mp.weixin.qq.com/s/example-id",
    author: "蔡垒磊",
    contentOriginKey: "wechat:nickname:请辩",
    contentOriginLabel: "请辩",
    publishedAt: new Date("2023-05-12T00:30:00.000Z"),
    publishedAtKind: PublishedAtKind.EXACT,
    archivePath,
    ingestionStatus: IngestionStatus.CATALOG,
    dedupeKey: "wechat:s:example-id",
  });
});

test("hydrateWechatArchiveDocument writes readable content, marks READY, and triggers the existing summary pipeline", async () => {
  const persistedInputs: Array<Record<string, unknown>> = [];
  let queuedDocumentId: string | null = null;

  const hydrated = await hydrateWechatArchiveDocument("catalog_doc", {
    getDocumentById: async () => ({
      id: "catalog_doc",
      ingestionStatus: IngestionStatus.CATALOG,
      archivePath,
    }),
    readFile: async () => archiveMarkdown,
    hydrateCatalogDocument: async (id, input) => {
      persistedInputs.push({ id, ...input });
      return {
        id,
        ingestionStatus: IngestionStatus.READY,
        archivePath,
        content: {
          plainText: input.plainText,
        },
      } as never;
    },
    queueAndRunAutomaticDocumentAiSummary: async (document) => {
      queuedDocumentId = document.id;
      return document;
    },
  });

  assert.equal(hydrated.ingestionStatus, IngestionStatus.READY);
  assert.equal(queuedDocumentId, "catalog_doc");
  assert.equal(persistedInputs.length, 1);
  assert.equal(persistedInputs[0].id, "catalog_doc");
  assert.equal(persistedInputs[0].ingestionStatus, IngestionStatus.READY);
  assert.match(String(persistedInputs[0].contentHtml), /<p>第一段正文。<\/p>/);
  assert.equal(persistedInputs[0].plainText, "第一段正文。\n\n第二段正文。");
  assert.equal(persistedInputs[0].wordCount, 12);
});

test("hydrateWechatArchiveDocument rejects documents outside the catalog state", async () => {
  await assert.rejects(
    hydrateWechatArchiveDocument("ready_doc", {
      getDocumentById: async () => ({
        id: "ready_doc",
        ingestionStatus: IngestionStatus.READY,
        archivePath,
      }),
    }),
    (error) => error instanceof RouteError && error.code === "DOCUMENT_NOT_IN_ARCHIVE_CATALOG",
  );
});
