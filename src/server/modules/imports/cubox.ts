import { createHash } from "node:crypto";
import { AiSummaryStatus, DocumentType, IngestionStatus, Prisma, PublishedAtKind, ReadState } from "@prisma/client";
import { deriveContentOriginMetadata, syncWechatSubsourceFromContentOrigin } from "@/lib/documents/content-origin";
import { RouteError } from "@/server/api/response";
import { prisma } from "@/server/db/client";
import { extractWebPageMetadata, type ExtractedWebPageMetadata } from "@/server/extractors/web/extract-web-page";
import { getSummaryRuntimeIssues, queueAutomaticDocumentAiSummary } from "@/server/modules/documents/document-ai-summary-jobs.service";
import { documentDetailArgs, type DocumentDetailRecord } from "@/server/modules/documents/document.repository";
import { upsertWechatSubsource } from "@/server/modules/documents/wechat-subsource.service";
import { generateDedupeKey } from "@/lib/documents/dedupe";

const CUBOX_HOSTS = new Set(["cubox.pro", "cubox.cc"]);
const DEFAULT_IMPORT_LIMIT = 20;
const CUBOX_API_REQUEST_TIMEOUT_MS = 15_000;
const CUBOX_SOURCE_METADATA_TIMEOUT_MS = 8_000;
const CUBOX_IMPORT_TRANSACTION_MAX_WAIT_MS = 10_000;
const CUBOX_IMPORT_TRANSACTION_TIMEOUT_MS = 60_000;
const IMAGE_HIGHLIGHT_PREFIX = "[Image highlight]";
const MARKDOWN_URL_FRAGMENT = String.raw`https?:\/\/(?:[^\s()]|\([^)\s]*\))+`;
const MARKDOWN_IMAGE_PATTERN = new RegExp(String.raw`!\[([^\]]*)\]\((${MARKDOWN_URL_FRAGMENT})\)`, "g");
const MARKDOWN_LINK_PATTERN = new RegExp(String.raw`\[([^\]]+)\]\((${MARKDOWN_URL_FRAGMENT})\)`, "g");

export type ParsedCuboxApiLink = {
  domain: "cubox.pro" | "cubox.cc";
  token: string;
};

export type CuboxDocumentContent = {
  contentHtml: string;
  plainText: string;
  excerpt: string | null;
  textHash: string;
};

export type CuboxCardTitleCandidate = {
  title?: string | null;
  article_title?: string | null;
};

export type CuboxHighlightInput = {
  text?: string | null;
  image_url?: string | null;
};

export type CuboxImportCursor = {
  lastCardId: string;
  lastCardUpdateTime: string;
};

export type CuboxImportBatchInput = {
  apiLink: string;
  cursor?: CuboxImportCursor | null;
  limit?: number | null;
};

export type CuboxImportBatchResult = {
  imported: number;
  updated: number;
  skipped: number;
  failed: number;
  summaryQueued: number;
  hasMore: boolean;
  nextCursor: CuboxImportCursor | null;
  errors: Array<{ cardId: string; message: string }>;
  summaryRuntimeIssues: string[];
};

type CuboxApiResponse<T> = {
  code?: number;
  message?: string;
  data?: T;
};

type CuboxCard = CuboxCardTitleCandidate & {
  id: string;
  title?: string | null;
  article_title?: string | null;
  description?: string | null;
  url?: string | null;
  create_time?: string | null;
  update_time?: string | null;
  word_count?: number | null;
  words_count?: number | null;
  highlights?: CuboxApiHighlight[] | null;
  tags?: string[] | null;
  type?: string | null;
};

type CuboxApiHighlight = CuboxHighlightInput & {
  id?: string | null;
  note?: string | null;
  color?: string | null;
  create_time?: string | null;
};

type CuboxTag = {
  name?: string | null;
  nested_name?: string | null;
};

type ImportedCuboxHighlight = {
  externalId: string;
  quoteText: string;
  note: string | null;
  color: string | null;
  timestamp: Date;
};

type ImportedCuboxDocument = {
  title: string;
  sourceUrl: string | null;
  canonicalUrl: string | null;
  excerpt: string | null;
  author: string | null;
  contentOriginKey: string | null;
  contentOriginLabel: string | null;
  content: CuboxDocumentContent | null;
  wordCount: number | null;
  ingestionStatus: IngestionStatus;
  publishedAt: Date | null;
  publishedAtKind: PublishedAtKind;
  createdAt: Date;
  updatedAt: Date;
  tagNames: string[];
  highlights: ImportedCuboxHighlight[];
};

type ImportedCuboxDocumentStatus = "imported" | "updated" | "skipped";

type ImportedCuboxDocumentResult = {
  document: DocumentDetailRecord;
  status: ImportedCuboxDocumentStatus;
};

type CuboxTagRecord = {
  id: string;
  name: string;
  slug: string;
};

export type CuboxSourceMetadata = Pick<ExtractedWebPageMetadata, "author" | "canonicalUrl" | "finalUrl" | "publishedAt"> & {
  wechatAccountName?: string | null;
  contentOriginKey?: string | null;
  contentOriginLabel?: string | null;
};

export function parseCuboxApiLink(input: string): ParsedCuboxApiLink {
  const value = input.trim();
  if (!value) {
    throw new RouteError("INVALID_CUBOX_API_LINK", 400, "Cubox API link is required.");
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new RouteError("INVALID_CUBOX_API_LINK", 400, "Cubox API link is invalid.");
  }

  if (!CUBOX_HOSTS.has(parsed.hostname)) {
    throw new RouteError("INVALID_CUBOX_API_LINK", 400, "Cubox API link host is not supported.");
  }

  const pathParts = parsed.pathname.split("/").filter(Boolean);
  if (pathParts.length !== 4 || pathParts[0] !== "c" || pathParts[1] !== "api" || pathParts[2] !== "save" || !pathParts[3]) {
    throw new RouteError("INVALID_CUBOX_API_LINK", 400, "Cubox API link path is invalid.");
  }

  return {
    domain: parsed.hostname as ParsedCuboxApiLink["domain"],
    token: pathParts[3],
  };
}

export function normalizeCuboxImportLimit(value: number | null | undefined) {
  if (!Number.isFinite(value)) {
    return DEFAULT_IMPORT_LIMIT;
  }

  const normalized = Math.trunc(value as number);
  if (normalized < 1) {
    throw new RouteError("INVALID_BODY", 400, '"limit" must be a positive integer.');
  }

  return Math.min(normalized, DEFAULT_IMPORT_LIMIT);
}

export function getCuboxImportTransactionOptions() {
  return {
    maxWait: CUBOX_IMPORT_TRANSACTION_MAX_WAIT_MS,
    timeout: CUBOX_IMPORT_TRANSACTION_TIMEOUT_MS,
  } as const;
}

export function getCuboxApiRequestTimeoutMs() {
  return CUBOX_API_REQUEST_TIMEOUT_MS;
}

export function normalizeCuboxSourceUrl(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return null;
    }

    parsed.hash = "";
    return parsed.toString();
  } catch {
    return null;
  }
}

export function renderCuboxMarkdownToDocumentContent(markdown: string): CuboxDocumentContent {
  const normalized = markdown.replace(/\r\n/g, "\n").trim();
  const lines = normalized ? normalized.split("\n") : [];
  const blocks: string[] = [];
  const plainTextBlocks: string[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trimEnd();

    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (/^#{1,6}\s+/.test(line)) {
      const depth = Math.min(line.match(/^#+/)?.[0].length ?? 1, 6);
      const text = line.slice(depth).trim();
      blocks.push(`<h${depth}>${renderInlineMarkdown(text)}</h${depth}>`);
      const plain = plainTextFromMarkdown(text);
      if (plain) {
        plainTextBlocks.push(plain);
      }
      index += 1;
      continue;
    }

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      const plains: string[] = [];
      while (index < lines.length && /^[-*]\s+/.test(lines[index].trim())) {
        const itemText = lines[index].trim().replace(/^[-*]\s+/, "");
        items.push(`<li>${renderInlineMarkdown(itemText)}</li>`);
        const plain = plainTextFromMarkdown(itemText);
        if (plain) {
          plains.push(plain);
        }
        index += 1;
      }
      blocks.push(`<ul>${items.join("")}</ul>`);
      if (plains.length > 0) {
        plainTextBlocks.push(plains.join("\n"));
      }
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quoteLines: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index].trim())) {
        quoteLines.push(lines[index].trim().replace(/^>\s?/, ""));
        index += 1;
      }
      const quoteText = quoteLines.join(" ");
      blocks.push(`<blockquote><p>${renderInlineMarkdown(quoteText)}</p></blockquote>`);
      const plain = plainTextFromMarkdown(quoteText);
      if (plain) {
        plainTextBlocks.push(plain);
      }
      continue;
    }

    const paragraphLines: string[] = [];
    while (index < lines.length && lines[index].trim()) {
      paragraphLines.push(lines[index].trim());
      index += 1;
    }

    const paragraph = paragraphLines.join(" ");
    blocks.push(`<p>${renderInlineMarkdown(paragraph)}</p>`);
    const plain = plainTextFromMarkdown(paragraph);
    if (plain) {
      plainTextBlocks.push(plain);
    }
  }

  const plainText = plainTextBlocks.join("\n\n").trim();
  return {
    contentHtml: blocks.join(""),
    plainText,
    excerpt: resolveRenderedCuboxExcerpt(plainTextBlocks),
    textHash: createHash("sha256").update(plainText).digest("hex"),
  };
}

export function resolveCuboxDocumentTitle(card: CuboxCardTitleCandidate, plainText: string) {
  const articleTitle = normalizeCandidate(card.article_title);
  if (articleTitle) {
    return articleTitle;
  }

  const title = normalizeCandidate(card.title);
  if (title) {
    return title;
  }

  const firstLine = plainText
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);

  return firstLine ?? "Untitled import";
}

export function resolveCuboxExcerpt(description: string | null | undefined, renderedExcerpt: string | null | undefined) {
  const normalizedDescription = normalizeCandidate(description);
  const normalizedRenderedExcerpt = normalizeCandidate(renderedExcerpt);

  if (!normalizedDescription) {
    return normalizedRenderedExcerpt ?? null;
  }

  if (!normalizedRenderedExcerpt) {
    return normalizedDescription;
  }

  if (normalizedDescription.length >= 20 && !isLikelyCuboxExcerptNoise(normalizedDescription)) {
    return normalizedDescription;
  }

  return normalizedRenderedExcerpt;
}

export function buildCuboxHighlightQuoteText(input: CuboxHighlightInput) {
  const text = normalizeCandidate(input.text);
  if (text) {
    return text;
  }

  const imageUrl = normalizeCuboxSourceUrl(input.image_url);
  return imageUrl ? `${IMAGE_HIGHLIGHT_PREFIX} ${imageUrl}` : IMAGE_HIGHLIGHT_PREFIX;
}

export function parseCuboxImportBatchInput(body: unknown): CuboxImportBatchInput {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new RouteError("INVALID_BODY", 400, "Request body must be a JSON object.");
  }

  const apiLink = (body as { apiLink?: unknown }).apiLink;
  const cursor = (body as { cursor?: unknown }).cursor;
  const limit = (body as { limit?: unknown }).limit;

  if (typeof apiLink !== "string" || apiLink.trim().length === 0) {
    throw new RouteError("INVALID_BODY", 400, '"apiLink" must be a non-empty string.');
  }

  if (typeof limit !== "undefined" && (typeof limit !== "number" || !Number.isInteger(limit))) {
    throw new RouteError("INVALID_BODY", 400, '"limit" must be an integer when provided.');
  }

  return {
    apiLink: apiLink.trim(),
    cursor: normalizeCuboxCursor(cursor),
    limit,
  };
}

export async function importCuboxBatch(input: CuboxImportBatchInput): Promise<CuboxImportBatchResult> {
  const parsedLink = parseCuboxApiLink(input.apiLink);
  const client = new CuboxClient(parsedLink);
  const limit = normalizeCuboxImportLimit(input.limit);
  const summaryRuntimeIssues = getSummaryRuntimeIssues({ requireInternalApiSecret: false });

  const [cardsResponse, tagDirectory] = await Promise.all([
    client.listCards({
      cursor: input.cursor ?? null,
      limit,
    }),
    client.listTags().catch(() => []),
  ]);

  const totals: Pick<CuboxImportBatchResult, "imported" | "updated" | "skipped" | "failed" | "summaryQueued"> = {
    imported: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    summaryQueued: 0,
  };
  const errors: CuboxImportBatchResult["errors"] = [];

  for (const card of cardsResponse.cards) {
    try {
      const result = await upsertCuboxCard(card, {
        client,
        tagDirectory,
      });

      totals[result.status] += 1;

      if (summaryRuntimeIssues.length === 0) {
        const queuedDocument = await queueAutomaticDocumentAiSummary(result.document, { allowRetry: true });
        if (queuedDocument.aiSummaryStatus === AiSummaryStatus.PENDING) {
          totals.summaryQueued += 1;
        }
      }
    } catch {
      totals.failed += 1;
      errors.push({
        cardId: card.id,
        message: "这条 Cubox 内容导入失败了，稍后可以重试这一批。",
      });
    }
  }

  return {
    ...totals,
    hasMore: cardsResponse.hasMore,
    nextCursor: cardsResponse.nextCursor,
    errors,
    summaryRuntimeIssues,
  };
}

async function upsertCuboxCard(
  card: CuboxCard,
  context: {
    client: CuboxClient;
    tagDirectory: CuboxTag[];
  },
): Promise<ImportedCuboxDocumentResult> {
  const markdown = await context.client.getCardContent(card.id);
  const sourceMetadata = await resolveCuboxSourceMetadata(card.url);
  const importedDocument = buildImportedCuboxDocument(card, markdown, context.tagDirectory, new Date(), sourceMetadata);
  await syncCuboxWechatSubsource(importedDocument, sourceMetadata);

  const dedupeKey = generateDedupeKey({
    type: DocumentType.WEB_PAGE,
    sourceUrl: importedDocument.sourceUrl,
    canonicalUrl: importedDocument.canonicalUrl,
  });

  const result = await prisma.$transaction(
    async (tx) => {
      const existingDocument = await tx.document.findFirst({
        where: {
          OR: [
            { type: DocumentType.WEB_PAGE, externalId: card.id },
            ...(dedupeKey ? [{ dedupeKey }] : []),
          ],
        },
        ...documentDetailArgs,
      });

      const tagRecords = await ensureCuboxTags(tx, importedDocument.tagNames);

      if (!existingDocument) {
        const createdDocument = await tx.document.create({
          data: {
            type: DocumentType.WEB_PAGE,
            title: importedDocument.title,
            sourceUrl: importedDocument.sourceUrl,
            canonicalUrl: importedDocument.canonicalUrl,
            dedupeKey,
            externalId: card.id,
            excerpt: importedDocument.excerpt,
            author: importedDocument.author,
            contentOriginKey: importedDocument.contentOriginKey,
            contentOriginLabel: importedDocument.contentOriginLabel,
            publishedAt: importedDocument.publishedAt,
            publishedAtKind: importedDocument.publishedAtKind,
            readState: ReadState.UNREAD,
            isFavorite: false,
            ingestionStatus: importedDocument.ingestionStatus,
            createdAt: importedDocument.createdAt,
            updatedAt: importedDocument.updatedAt,
          },
          ...documentDetailArgs,
        });

        await syncDocumentContent(tx, createdDocument.id, null, importedDocument);
        await syncDocumentTags(tx, createdDocument.id, [], tagRecords);
        await syncCuboxHighlights(tx, createdDocument.id, [], importedDocument.highlights);

        const document = await tx.document.findUniqueOrThrow({
          where: { id: createdDocument.id },
          ...documentDetailArgs,
        });

        return {
          document,
          status: "imported" as const,
        };
      }

      const nextDocumentData = {
        title: importedDocument.title,
        sourceUrl: importedDocument.sourceUrl,
        canonicalUrl: existingDocument.canonicalUrl ?? importedDocument.canonicalUrl,
        excerpt: importedDocument.excerpt,
        author: existingDocument.author ?? importedDocument.author,
        contentOriginKey: existingDocument.contentOriginKey ?? importedDocument.contentOriginKey,
        contentOriginLabel: existingDocument.contentOriginLabel ?? importedDocument.contentOriginLabel,
        ingestionStatus: importedDocument.ingestionStatus,
        publishedAt: importedDocument.publishedAt,
        publishedAtKind: importedDocument.publishedAtKind,
      };

      const documentChanged =
        existingDocument.title !== nextDocumentData.title ||
        existingDocument.sourceUrl !== nextDocumentData.sourceUrl ||
        existingDocument.canonicalUrl !== nextDocumentData.canonicalUrl ||
        existingDocument.excerpt !== nextDocumentData.excerpt ||
        existingDocument.author !== nextDocumentData.author ||
        existingDocument.contentOriginKey !== nextDocumentData.contentOriginKey ||
        existingDocument.contentOriginLabel !== nextDocumentData.contentOriginLabel ||
        existingDocument.publishedAt?.toISOString() !== nextDocumentData.publishedAt?.toISOString() ||
        existingDocument.publishedAtKind !== nextDocumentData.publishedAtKind ||
        existingDocument.ingestionStatus !== nextDocumentData.ingestionStatus;

      const contentChanged = await syncDocumentContent(tx, existingDocument.id, existingDocument, importedDocument);
      const tagChanged = await syncDocumentTags(tx, existingDocument.id, existingDocument.tags.map((entry) => entry.tag), tagRecords);
      const existingHighlights = await tx.highlight.findMany({
        where: { documentId: existingDocument.id },
      });
      const highlightChanged = await syncCuboxHighlights(tx, existingDocument.id, existingHighlights, importedDocument.highlights);
      const shouldResetSummary = documentChanged || contentChanged;

      if (documentChanged || shouldResetSummary) {
        await tx.document.update({
          where: { id: existingDocument.id },
          data: {
            ...nextDocumentData,
            ...(shouldResetSummary
              ? {
                  aiSummary: null,
                  aiSummaryStatus: null,
                  aiSummaryError: null,
                }
              : {}),
          },
        });
      }

      const document = await tx.document.findUniqueOrThrow({
        where: { id: existingDocument.id },
        ...documentDetailArgs,
      });

      return {
        document,
        status: documentChanged || contentChanged || tagChanged || highlightChanged ? ("updated" as const) : ("skipped" as const),
      };
    },
    getCuboxImportTransactionOptions(),
  );

  return result;
}

export function buildImportedCuboxDocument(
  card: CuboxCard,
  markdown: string | null,
  tagDirectory: CuboxTag[],
  importedAt: Date,
  sourceMetadata?: CuboxSourceMetadata | null,
): ImportedCuboxDocument {
  const renderedContent = markdown?.trim() ? renderCuboxMarkdownToDocumentContent(markdown) : null;
  const excerpt = resolveCuboxExcerpt(card.description, renderedContent?.excerpt);
  const title = resolveCuboxDocumentTitle(card, [renderedContent?.plainText ?? "", excerpt ?? ""].join("\n"));
  const sourceUrl = normalizeCuboxSourceUrl(card.url);
  const canonicalUrl = sourceMetadata?.canonicalUrl ?? sourceMetadata?.finalUrl ?? sourceUrl;
  const contentOrigin = deriveContentOriginMetadata({
    author: sourceMetadata?.author ?? null,
    canonicalUrl,
    finalUrl: sourceMetadata?.finalUrl ?? null,
    sourceUrl,
    wechatAccountName: sourceMetadata?.wechatAccountName ?? null,
  });
  const { createdAt, updatedAt } = resolveCuboxDocumentTimestamps(card, importedAt);
  const publishedAt = sourceMetadata?.publishedAt ?? null;
  const tagNames = resolveCuboxTagNames(card.tags, tagDirectory);
  const highlights = normalizeCuboxHighlights(card.highlights, updatedAt);
  const hasReadablePayload = Boolean(
    normalizeCandidate(card.article_title) || normalizeCandidate(card.title) || excerpt || renderedContent?.plainText,
  );

  return {
    title,
    sourceUrl,
    canonicalUrl,
    excerpt,
    author: sourceMetadata?.author ?? null,
    contentOriginKey: sourceMetadata?.contentOriginKey ?? contentOrigin.key,
    contentOriginLabel: sourceMetadata?.contentOriginLabel ?? contentOrigin.label,
    content: renderedContent,
    wordCount: resolveCuboxWordCount(card, renderedContent?.plainText ?? ""),
    ingestionStatus: hasReadablePayload ? IngestionStatus.READY : IngestionStatus.FAILED,
    publishedAt,
    publishedAtKind: publishedAt ? PublishedAtKind.EXACT : PublishedAtKind.UNKNOWN,
    createdAt,
    updatedAt,
    tagNames,
    highlights,
  };
}

export async function syncCuboxWechatSubsource(
  importedDocument: Pick<ImportedCuboxDocument, "contentOriginKey" | "contentOriginLabel">,
  sourceMetadata: CuboxSourceMetadata | null,
  deps: {
    upsertWechatSubsource?: typeof upsertWechatSubsource;
  } = {},
) {
  const upsert = deps.upsertWechatSubsource ?? upsertWechatSubsource;

  return syncWechatSubsourceFromContentOrigin(
    {
      isWechat: Boolean(importedDocument.contentOriginKey?.startsWith("wechat:biz:")),
      key: importedDocument.contentOriginKey ?? null,
      label: importedDocument.contentOriginLabel ?? null,
    },
    {
      wechatAccountName: sourceMetadata?.wechatAccountName ?? null,
    },
    upsert,
  );
}

async function resolveCuboxSourceMetadata(sourceUrl: string | null | undefined) {
  const normalizedSourceUrl = normalizeCuboxSourceUrl(sourceUrl);
  if (!normalizedSourceUrl) {
    return null;
  }

  try {
    const metadata = await extractWebPageMetadata(normalizedSourceUrl, {
      signal: AbortSignal.timeout(CUBOX_SOURCE_METADATA_TIMEOUT_MS),
    });
    const contentOrigin = deriveContentOriginMetadata({
      author: metadata.author,
      canonicalUrl: metadata.canonicalUrl,
      finalUrl: metadata.finalUrl,
      sourceUrl: normalizedSourceUrl,
      wechatAccountName: metadata.wechatAccountName,
    });

    return {
      ...metadata,
      contentOriginKey: contentOrigin.key,
      contentOriginLabel: contentOrigin.label,
    };
  } catch {
    return null;
  }
}

export function resolveCuboxDocumentTimestamps(
  card: Pick<CuboxCard, "create_time" | "update_time">,
  importedAt: Date,
) {
  const readerTimestamp = new Date(importedAt);

  return {
    createdAt: readerTimestamp,
    updatedAt: readerTimestamp,
    cuboxUpdatedAt: parseCuboxDate(card.update_time),
    cuboxCreatedAt: parseCuboxDate(card.create_time),
  };
}

async function syncDocumentContent(
  tx: Prisma.TransactionClient,
  documentId: string,
  existingDocument: DocumentDetailRecord | null,
  importedDocument: ImportedCuboxDocument,
) {
  const existingContent = existingDocument?.content ?? null;
  const nextContent = importedDocument.content;

  if (!nextContent) {
    if (!existingContent) {
      return false;
    }

    await tx.documentContent.delete({
      where: {
        documentId,
      },
    });
    return true;
  }

  const wordCount = importedDocument.wordCount;
  const nextContentData = {
    contentHtml: nextContent.contentHtml,
    plainText: nextContent.plainText,
    rawHtml: null,
    textHash: nextContent.textHash,
    wordCount,
    extractedAt: importedDocument.updatedAt,
  };

  const contentChanged =
    existingContent?.contentHtml !== nextContentData.contentHtml ||
    existingContent?.plainText !== nextContentData.plainText ||
    existingContent?.textHash !== nextContentData.textHash ||
    existingContent?.wordCount !== nextContentData.wordCount;

  if (!existingContent) {
    await tx.documentContent.create({
      data: {
        documentId,
        ...nextContentData,
      },
    });
    return true;
  }

  if (!contentChanged) {
    return false;
  }

  await tx.documentContent.update({
    where: {
      documentId,
    },
    data: nextContentData,
  });

  return true;
}

async function syncDocumentTags(
  tx: Prisma.TransactionClient,
  documentId: string,
  existingTags: Array<{ id: string }>,
  nextTags: CuboxTagRecord[],
) {
  const existingTagIds = new Set(existingTags.map((tag) => tag.id));
  const nextTagIds = new Set(nextTags.map((tag) => tag.id));

  const tagIdsToDelete = existingTags.filter((tag) => !nextTagIds.has(tag.id)).map((tag) => tag.id);
  const tagIdsToCreate = nextTags.filter((tag) => !existingTagIds.has(tag.id)).map((tag) => tag.id);

  if (tagIdsToDelete.length > 0) {
    await tx.documentTag.deleteMany({
      where: {
        documentId,
        tagId: {
          in: tagIdsToDelete,
        },
      },
    });
  }

  if (tagIdsToCreate.length > 0) {
    await tx.documentTag.createMany({
      data: tagIdsToCreate.map((tagId) => ({
        documentId,
        tagId,
      })),
      skipDuplicates: true,
    });
  }

  return tagIdsToDelete.length > 0 || tagIdsToCreate.length > 0;
}

async function syncCuboxHighlights(
  tx: Prisma.TransactionClient,
  documentId: string,
  existingHighlights: Array<{
    id: string;
    externalId: string | null;
    quoteText: string;
    note: string | null;
    color: string | null;
    createdAt: Date;
  }>,
  nextHighlights: ImportedCuboxHighlight[],
) {
  const nextHighlightIds = nextHighlights.map((highlight) => highlight.externalId);
  let changed = false;

  if (nextHighlightIds.length === 0) {
    const deleted = await tx.highlight.deleteMany({
      where: {
        documentId,
        externalId: {
          not: null,
        },
      },
    });
    return deleted.count > 0;
  }

  const deleted = await tx.highlight.deleteMany({
    where: {
      documentId,
      externalId: {
        not: null,
        notIn: nextHighlightIds,
      },
    },
  });
  changed ||= deleted.count > 0;

  const existingByExternalId = new Map(
    existingHighlights
      .filter((highlight): highlight is typeof highlight & { externalId: string } => Boolean(highlight.externalId))
      .map((highlight) => [highlight.externalId, highlight]),
  );

  for (const highlight of nextHighlights) {
    const existingHighlight = existingByExternalId.get(highlight.externalId);

    if (!existingHighlight) {
      await tx.highlight.create({
        data: {
          documentId,
          externalId: highlight.externalId,
          quoteText: highlight.quoteText,
          note: highlight.note,
          color: highlight.color,
          startOffset: null,
          endOffset: null,
          selectorJson: Prisma.JsonNull,
          createdAt: highlight.timestamp,
          updatedAt: highlight.timestamp,
        },
      });
      changed = true;
      continue;
    }

    const shouldUpdate =
      existingHighlight.quoteText !== highlight.quoteText ||
      existingHighlight.note !== highlight.note ||
      existingHighlight.color !== highlight.color ||
      existingHighlight.createdAt.getTime() !== highlight.timestamp.getTime();

    if (!shouldUpdate) {
      continue;
    }

    await tx.highlight.update({
      where: {
        id: existingHighlight.id,
      },
      data: {
        quoteText: highlight.quoteText,
        note: highlight.note,
        color: highlight.color,
        createdAt: highlight.timestamp,
        updatedAt: highlight.timestamp,
      },
    });
    changed = true;
  }

  return changed;
}

async function ensureCuboxTags(tx: Prisma.TransactionClient, tagNames: string[]) {
  if (tagNames.length === 0) {
    return [];
  }

  const uniqueNames = Array.from(new Set(tagNames.map((name) => normalizeCandidate(name)).filter(isNonEmptyString))).sort();
  const existingTags = await tx.tag.findMany({
    where: {
      name: {
        in: uniqueNames,
      },
    },
  });
  const tagsByName = new Map(existingTags.map((tag) => [tag.name, tag]));
  const resolvedTags: CuboxTagRecord[] = [];

  for (const name of uniqueNames) {
    const existingTag = tagsByName.get(name);
    if (existingTag) {
      resolvedTags.push(existingTag);
      continue;
    }

    const createdTag = await tx.tag.create({
      data: {
        name,
        slug: await buildUniqueTagSlug(tx, name),
      },
    });

    resolvedTags.push(createdTag);
  }

  return resolvedTags;
}

async function buildUniqueTagSlug(tx: Prisma.TransactionClient, name: string) {
  const baseSlug = slugifyTagName(name) || "tag";
  let candidate = baseSlug;
  let attempt = 1;

  while (await tx.tag.findUnique({ where: { slug: candidate } })) {
    attempt += 1;
    candidate = `${baseSlug}-${attempt}`;
  }

  return candidate;
}

function resolveCuboxTagNames(cardTags: string[] | null | undefined, tagDirectory: CuboxTag[]) {
  const directoryByName = new Map<string, string>();

  for (const tag of tagDirectory) {
    const name = normalizeCandidate(tag.name) ?? normalizeCandidate(tag.nested_name);
    if (!name) {
      continue;
    }

    directoryByName.set(name.toLowerCase(), name);
  }

  return Array.from(
    new Set(
      (cardTags ?? [])
        .map((tag) => normalizeCandidate(tag))
        .filter(isNonEmptyString)
        .map((tag) => directoryByName.get(tag.toLowerCase()) ?? tag),
    ),
  ).sort((left, right) => left.localeCompare(right, "zh-CN"));
}

function normalizeCuboxHighlights(highlights: CuboxApiHighlight[] | null | undefined, fallbackTime: Date) {
  return (highlights ?? [])
    .map((highlight) => {
      const externalId = normalizeCandidate(highlight.id);
      if (!externalId) {
        return null;
      }

      return {
        externalId,
        quoteText: buildCuboxHighlightQuoteText(highlight),
        note: normalizeCandidate(highlight.note),
        color: normalizeCandidate(highlight.color),
        timestamp: parseCuboxDate(highlight.create_time) ?? fallbackTime,
      };
    })
    .filter((highlight): highlight is ImportedCuboxHighlight => Boolean(highlight));
}

function resolveCuboxWordCount(card: CuboxCard, plainText: string) {
  const directWordCount = [card.word_count, card.words_count].find((value) => Number.isFinite(value));
  if (typeof directWordCount === "number") {
    return Math.max(0, Math.trunc(directWordCount));
  }

  const normalized = plainText.replace(/\s+/g, "");
  return normalized ? normalized.length : null;
}

function parseCuboxDate(value: string | null | undefined) {
  const normalized = normalizeCandidate(value);
  if (!normalized) {
    return null;
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

function normalizeCuboxCursor(value: unknown): CuboxImportCursor | null | undefined {
  if (typeof value === "undefined") {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new RouteError("INVALID_BODY", 400, '"cursor" must be an object when provided.');
  }

  const lastCardId = (value as { lastCardId?: unknown }).lastCardId;
  const lastCardUpdateTime = (value as { lastCardUpdateTime?: unknown }).lastCardUpdateTime;

  if (typeof lastCardId !== "string" || !lastCardId.trim() || typeof lastCardUpdateTime !== "string" || !lastCardUpdateTime.trim()) {
    throw new RouteError("INVALID_BODY", 400, '"cursor" must include non-empty "lastCardId" and "lastCardUpdateTime" strings.');
  }

  return {
    lastCardId: lastCardId.trim(),
    lastCardUpdateTime: lastCardUpdateTime.trim(),
  };
}

function renderInlineMarkdown(value: string) {
  const escaped = escapeHtml(value);
  const withImages = escaped.replace(MARKDOWN_IMAGE_PATTERN, (_match, altText: string, url: string) => {
    const normalizedAltText = normalizeCandidate(altText);
    return `<img src="${url}" alt="${escapeHtml(normalizedAltText ?? "")}" />`;
  });
  const withLinks = withImages.replace(MARKDOWN_LINK_PATTERN, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
  const withBold = withLinks.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  const withItalic = withBold.replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>");
  return withItalic;
}

function plainTextFromMarkdown(value: string) {
  return value
    .replace(MARKDOWN_IMAGE_PATTERN, (_match, altText: string) => normalizeCandidate(altText) ?? "")
    .replace(MARKDOWN_LINK_PATTERN, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1$2")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCandidate(value: string | null | undefined) {
  const normalized = value?.replace(/\s+/g, " ").trim();
  return normalized ? normalized : null;
}

function isNonEmptyString(value: string | null): value is string {
  return typeof value === "string" && value.length > 0;
}

function slugifyTagName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function resolveRenderedCuboxExcerpt(plainTextBlocks: string[]) {
  const normalizedBlocks = plainTextBlocks.map((block) => normalizeCandidate(block)).filter(isNonEmptyString);

  const meaningfulBlock =
    normalizedBlocks.find((block) => !isLikelyCuboxExcerptNoise(block) && block.length >= 20) ??
    normalizedBlocks.find((block) => !isLikelyCuboxExcerptNoise(block)) ??
    normalizedBlocks[0];

  return meaningfulBlock ? meaningfulBlock.slice(0, 240) : null;
}

function isLikelyCuboxExcerptNoise(value: string) {
  return (
    /^(文|作者|来源|by)[:：]/i.test(value) ||
    /^https?:\/\/\S+$/i.test(value) ||
    /^[.。…·_\-\s]{4,}$/.test(value)
  );
}

class CuboxClient {
  private readonly endpoint: string;
  private readonly token: string;

  constructor(parsedLink: ParsedCuboxApiLink) {
    this.endpoint = `https://${parsedLink.domain}`;
    this.token = parsedLink.token;
  }

  async listCards(input: { cursor: CuboxImportCursor | null; limit: number }) {
    const requestBody: Record<string, unknown> = {
      limit: input.limit,
    };

    if (input.cursor) {
      requestBody.last_card_id = input.cursor.lastCardId;
      requestBody.last_card_update_time = input.cursor.lastCardUpdateTime;
    }

    const response = await this.request<CuboxCard[]>("/c/api/third-party/card/filter", {
      method: "POST",
      body: JSON.stringify(requestBody),
    });
    const cards = Array.isArray(response) ? response.filter(isCuboxCard) : [];
    const lastCard = cards.at(-1);
    const hasMore = cards.length >= input.limit && Boolean(lastCard?.id && normalizeCandidate(lastCard.update_time));

    return {
      cards,
      hasMore,
      nextCursor:
        hasMore && lastCard?.id && normalizeCandidate(lastCard.update_time)
          ? {
              lastCardId: lastCard.id,
              lastCardUpdateTime: normalizeCandidate(lastCard.update_time)!,
            }
          : null,
    };
  }

  async getCardContent(cardId: string) {
    try {
      const response = await this.request<string>(`/c/api/third-party/card/content?id=${encodeURIComponent(cardId)}`);
      return typeof response === "string" ? response : null;
    } catch {
      return null;
    }
  }

  async listTags() {
    const response = await this.request<CuboxTag[]>("/c/api/third-party/tag/list");
    return Array.isArray(response) ? response : [];
  }

  private async request<T>(path: string, init?: RequestInit) {
    let response: Response;

    try {
      response = await fetch(`${this.endpoint}${path}`, {
        method: init?.method ?? "GET",
        headers: {
          authorization: `Bearer ${this.token}`,
          "content-type": "application/json",
          "user-agent": "reader-app/0.1",
          ...(init?.headers ?? {}),
        },
        body: init?.body,
        cache: "no-store",
        signal: init?.signal ?? AbortSignal.timeout(getCuboxApiRequestTimeoutMs()),
      });
    } catch {
      throw new RouteError("CUBOX_API_UNAVAILABLE", 502, "Failed to reach Cubox.");
    }

    if (!response.ok) {
      throw new RouteError("CUBOX_API_UNAVAILABLE", 502, "Cubox request failed.");
    }

    let payload: CuboxApiResponse<T>;
    try {
      payload = (await response.json()) as CuboxApiResponse<T>;
    } catch {
      throw new RouteError("CUBOX_API_INVALID_RESPONSE", 502, "Cubox response was invalid.");
    }

    if (typeof payload.code === "number" && payload.code >= 400) {
      throw new RouteError("CUBOX_API_REJECTED", 502, "Cubox rejected the request.");
    }

    return payload.data as T;
  }
}

function isCuboxCard(value: unknown): value is CuboxCard {
  return Boolean(value && typeof value === "object" && typeof (value as { id?: unknown }).id === "string");
}
