import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { DocumentType, IngestionStatus, Prisma, PublishedAtKind } from "@prisma/client";
import { deriveContentOriginMetadata, syncWechatSubsourceFromContentOrigin } from "@/lib/documents/content-origin";
import { generateDedupeKey } from "@/lib/documents/dedupe";
import { RouteError } from "@/server/api/response";
import {
  createWechatCatalogDocument,
  findDocumentByDedupeKey,
  getDocumentById,
  promoteCatalogDocumentToReady,
  type DocumentDetailRecord,
} from "@/server/modules/documents/document.repository";
import { queueAndRunAutomaticDocumentAiSummary } from "@/server/modules/documents/document-ai-summary-jobs.service";
import { upsertWechatSubsource } from "@/server/modules/documents/wechat-subsource.service";
import { renderCuboxMarkdownToDocumentContent } from "./cubox";

export type ParsedWechatArchive = {
  title: string;
  sourceUrl: string;
  accountName: string;
  author: string | null;
  publishedAt: Date | null;
  bodyMarkdown: string;
};

const PUBLISHED_AT_PATTERN = /(\d{4}-\d{2}-\d{2})(?:\s+(\d{2}:\d{2}))?/;

type ImportWechatArchiveCatalogOptions = {
  rootPath: string;
};

type ImportWechatArchiveCatalogDependencies = {
  listArchivePaths?: typeof listWechatArchiveMarkdownPaths;
  readFile?: (archivePath: string) => Promise<string>;
  findDocumentByDedupeKey?: (dedupeKey: string) => Promise<{ id: string } | null>;
  createWechatCatalogDocument?: typeof createWechatCatalogDocument;
  syncWechatSubsource?: typeof syncArchiveWechatSubsource;
};

type HydrateWechatArchiveDocumentDependencies = {
  getDocumentById?: (id: string) => Promise<{
    id: string;
    ingestionStatus: IngestionStatus;
    archivePath: string | null;
  } | null>;
  promoteCatalogDocumentToReady?: typeof promoteCatalogDocumentToReady;
  queueAndRunAutomaticDocumentAiSummary?: typeof queueAndRunAutomaticDocumentAiSummary;
};

export type WechatArchiveCatalogImportResult = {
  scanned: number;
  created: number;
  skipped: number;
  failed: number;
  failures: Array<{
    archivePath: string;
    message: string;
  }>;
};

export function parseWechatArchiveMarkdown(markdown: string, archivePath: string): ParsedWechatArchive {
  const normalized = markdown.replace(/\r\n/g, "\n").trim();
  const lines = normalized.split("\n");
  const accountName = path.basename(path.dirname(path.dirname(archivePath))).trim();
  const title = findArchiveTitle(lines);
  const sourceLineIndex = lines.findIndex((line) => line.includes("原文地址"));
  const sourceUrl = sourceLineIndex >= 0 ? readOriginalUrl(lines[sourceLineIndex]) : null;
  const metadataLine = lines.find((line, index) => index < sourceLineIndex && PUBLISHED_AT_PATTERN.test(line));
  const publishedAtMatch = metadataLine?.match(PUBLISHED_AT_PATTERN) ?? null;

  if (!title) {
    throw new Error(`Archive title was not found: ${archivePath}`);
  }

  if (!sourceUrl) {
    throw new Error(`Archive source URL was not found: ${archivePath}`);
  }

  return {
    title,
    sourceUrl,
    accountName,
    author: resolveArchiveAuthor(metadataLine ?? null, accountName, publishedAtMatch?.index ?? -1),
    publishedAt: publishedAtMatch ? parseArchivePublishedAt(publishedAtMatch[1], publishedAtMatch[2]) : null,
    bodyMarkdown: extractArchiveBody(lines, sourceLineIndex),
  };
}

export async function importWechatArchiveCatalog(
  options: ImportWechatArchiveCatalogOptions,
  dependencies: ImportWechatArchiveCatalogDependencies = {},
): Promise<WechatArchiveCatalogImportResult> {
  const listArchivePaths = dependencies.listArchivePaths ?? listWechatArchiveMarkdownPaths;
  const loadArchive = dependencies.readFile ?? readArchiveFile;
  const findByDedupeKey = dependencies.findDocumentByDedupeKey ?? findDocumentByDedupeKey;
  const createCatalogDocument = dependencies.createWechatCatalogDocument ?? createWechatCatalogDocument;
  const syncWechatSubsource = dependencies.syncWechatSubsource ?? syncArchiveWechatSubsource;
  const archivePaths = await listArchivePaths(options.rootPath);
  const result: WechatArchiveCatalogImportResult = {
    scanned: archivePaths.length,
    created: 0,
    skipped: 0,
    failed: 0,
    failures: [],
  };

  for (const archivePath of archivePaths) {
    try {
      const parsed = parseWechatArchiveMarkdown(await loadArchive(archivePath), archivePath);
      const canonicalUrl = parsed.sourceUrl;
      const dedupeKey = generateDedupeKey({
        type: DocumentType.WEB_PAGE,
        sourceUrl: parsed.sourceUrl,
        canonicalUrl,
      });

      if (!dedupeKey) {
        throw new Error("Archive document does not have a stable dedupe key.");
      }

      if (await findByDedupeKey(dedupeKey)) {
        result.skipped += 1;
        continue;
      }

      const contentOrigin = deriveContentOriginMetadata({
        author: parsed.author,
        canonicalUrl,
        sourceUrl: parsed.sourceUrl,
        wechatAccountName: parsed.accountName,
      });

      const rendered = renderCuboxMarkdownToDocumentContent(parsed.bodyMarkdown);
      if (!rendered.plainText) {
        throw new Error("Archive markdown does not contain readable content.");
      }

      await createCatalogDocument({
        title: parsed.title,
        sourceUrl: parsed.sourceUrl,
        canonicalUrl,
        author: parsed.author,
        contentOriginKey: contentOrigin.key,
        contentOriginLabel: contentOrigin.label,
        publishedAt: parsed.publishedAt,
        publishedAtKind: parsed.publishedAt ? PublishedAtKind.EXACT : PublishedAtKind.UNKNOWN,
        archivePath,
        ingestionStatus: IngestionStatus.CATALOG,
        dedupeKey,
        excerpt: rendered.excerpt,
        contentHtml: rendered.contentHtml,
        plainText: rendered.plainText,
        rawHtml: null,
        textHash: rendered.textHash,
        wordCount: countReadableUnits(rendered.plainText),
        extractedAt: new Date(),
      });
      await syncWechatSubsource(contentOrigin, parsed.accountName);
      result.created += 1;
    } catch (error) {
      if (isUniqueConstraintConflict(error)) {
        result.skipped += 1;
        continue;
      }

      result.failed += 1;
      result.failures.push({
        archivePath,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}

export async function hydrateWechatArchiveDocument(
  id: string,
  dependencies: HydrateWechatArchiveDocumentDependencies = {},
): Promise<DocumentDetailRecord> {
  const fetchDocument = dependencies.getDocumentById ?? getDocumentById;
  const promote = dependencies.promoteCatalogDocumentToReady ?? promoteCatalogDocumentToReady;
  const queueSummary =
    dependencies.queueAndRunAutomaticDocumentAiSummary ?? queueAndRunAutomaticDocumentAiSummary;
  const document = await fetchDocument(id);

  if (!document) {
    throw new RouteError("DOCUMENT_NOT_FOUND", 404, "Document was not found.");
  }

  if (document.ingestionStatus !== IngestionStatus.CATALOG) {
    throw new RouteError(
      "DOCUMENT_NOT_IN_ARCHIVE_CATALOG",
      409,
      "Only archive catalog documents can be imported.",
    );
  }

  // Content was stored when the catalog entry was created, so importing only promotes
  // the document into the reading flow and queues the AI summary — no filesystem access.
  const promoted = await promote(id);
  return queueSummary(promoted);
}

export async function listWechatArchiveMarkdownPaths(rootPath: string) {
  const accountEntries = await readdir(rootPath, { withFileTypes: true });
  const archivePaths: string[] = [];

  for (const accountEntry of accountEntries) {
    if (!accountEntry.isDirectory()) {
      continue;
    }

    const markdownDirectory = path.join(rootPath, accountEntry.name, "md");
    let markdownEntries;
    try {
      markdownEntries = await readdir(markdownDirectory, { withFileTypes: true });
    } catch (error) {
      if (isMissingPathError(error)) {
        continue;
      }
      throw error;
    }

    for (const markdownEntry of markdownEntries) {
      if (markdownEntry.isFile() && isWechatArchiveMarkdownFile(markdownEntry.name)) {
        archivePaths.push(path.join(markdownDirectory, markdownEntry.name));
      }
    }
  }

  return archivePaths.sort((left, right) => left.localeCompare(right, "zh-CN"));
}

export function isWechatArchiveMarkdownFile(fileName: string) {
  const normalized = fileName.toLowerCase();
  return normalized.endsWith(".md") && !normalized.endsWith(".obsidian.md");
}

async function readArchiveFile(archivePath: string) {
  return readFile(archivePath, "utf8");
}

async function syncArchiveWechatSubsource(
  contentOrigin: ReturnType<typeof deriveContentOriginMetadata>,
  accountName: string,
) {
  return syncWechatSubsourceFromContentOrigin(
    contentOrigin,
    { wechatAccountName: accountName },
    upsertWechatSubsource,
  );
}

function countReadableUnits(plainText: string) {
  const normalized = plainText.replace(/\s+/g, "");
  return normalized ? normalized.length : null;
}

function isUniqueConstraintConflict(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function isMissingPathError(error: unknown) {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

function findArchiveTitle(lines: string[]) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index].trim();
    const atxMatch = line.match(/^#\s+(.+)$/);
    if (atxMatch) {
      return atxMatch[1].trim();
    }

    if (line && /^=+$/.test(lines[index + 1]?.trim() ?? "")) {
      return line;
    }
  }

  return null;
}

function readOriginalUrl(line: string) {
  const markdownLink = line.match(/\((https?:\/\/[^)\s]+)\)/);
  if (markdownLink) {
    return markdownLink[1];
  }

  return line.match(/https?:\/\/[^\s)>]+/)?.[0] ?? null;
}

function resolveArchiveAuthor(metadataLine: string | null, accountName: string, publishedAtIndex: number) {
  if (!metadataLine || publishedAtIndex < 0) {
    return null;
  }

  let prefix = metadataLine
    .slice(0, publishedAtIndex)
    .replace(/^\s*(?:原创|转载|首发)\s+/, "")
    .trim();

  if (accountName && prefix.endsWith(accountName)) {
    prefix = prefix.slice(0, -accountName.length).trim();
  }

  return prefix || null;
}

function parseArchivePublishedAt(date: string, time?: string) {
  return new Date(`${date}T${time ?? "00:00"}:00+08:00`);
}

function extractArchiveBody(lines: string[], sourceLineIndex: number) {
  if (sourceLineIndex < 0) {
    return "";
  }

  const bodyLines = lines.slice(sourceLineIndex + 1);
  while (bodyLines.length > 0 && isArchivePreambleLine(bodyLines[0])) {
    bodyLines.shift();
  }

  return bodyLines.join("\n").trim();
}

function isArchivePreambleLine(line: string) {
  const trimmed = line.trim();
  return !trimmed || /^[—–_=*\-\s]+$/.test(trimmed);
}
