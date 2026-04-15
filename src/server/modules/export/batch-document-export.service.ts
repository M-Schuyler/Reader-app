import JSZip from "jszip";
import { RouteError } from "@/server/api/response";
import { getDocument } from "@/server/modules/documents/document.service";
import { listExportHighlightsByDocumentIds } from "@/server/modules/highlights/highlight.repository";
import {
  buildDocumentDownload,
  buildDocumentDownloadFileName,
  parseDocumentDownloadFormat,
} from "./document-export.service";
import type { DocumentDownloadFormat } from "./document-export.types";

export const MAX_BATCH_EXPORT_DOCUMENTS = 50;

export type BatchDocumentDownloadInput = {
  documentIds: string[];
  format: DocumentDownloadFormat;
};

export type BuiltBatchDocumentDownloadArchive = {
  content: Buffer;
  exportedCount: number;
  exportedAt: string;
  fileName: string;
  format: DocumentDownloadFormat;
  missingIds: string[];
};

type BuildBatchDocumentDownloadDependencies = {
  getDocument?: typeof getDocument;
  listExportHighlightsByDocumentIds?: typeof listExportHighlightsByDocumentIds;
  now?: () => Date;
};

export function parseBatchDocumentDownloadInput(body: unknown): BatchDocumentDownloadInput {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new RouteError("INVALID_BODY", 400, "Batch export payload must be a JSON object.");
  }

  const rawIds = (body as { documentIds?: unknown }).documentIds;
  if (!Array.isArray(rawIds)) {
    throw new RouteError("INVALID_BODY", 400, '"documentIds" must be an array of document IDs.');
  }

  const dedupedIds: string[] = [];
  const seen = new Set<string>();

  for (const rawId of rawIds) {
    if (typeof rawId !== "string") {
      throw new RouteError("INVALID_BODY", 400, "Each document ID must be a non-empty string.");
    }

    const id = rawId.trim();
    if (!id) {
      throw new RouteError("INVALID_BODY", 400, "Each document ID must be a non-empty string.");
    }

    if (seen.has(id)) {
      continue;
    }

    seen.add(id);
    dedupedIds.push(id);
  }

  if (dedupedIds.length === 0) {
    throw new RouteError("INVALID_BODY", 400, "Select at least one document to export.");
  }

  if (dedupedIds.length > MAX_BATCH_EXPORT_DOCUMENTS) {
    throw new RouteError(
      "BATCH_EXPORT_LIMIT_EXCEEDED",
      400,
      `Batch export supports up to ${MAX_BATCH_EXPORT_DOCUMENTS} documents at a time.`,
    );
  }

  const rawFormat = (body as { format?: unknown }).format;
  if (typeof rawFormat !== "undefined" && typeof rawFormat !== "string") {
    throw new RouteError("INVALID_BODY", 400, '"format" must be a string when provided.');
  }

  return {
    documentIds: dedupedIds,
    format: parseDocumentDownloadFormat(rawFormat ?? "obsidian"),
  };
}

export async function buildBatchDocumentDownloadArchive(
  input: BatchDocumentDownloadInput,
  dependencies: BuildBatchDocumentDownloadDependencies = {},
): Promise<BuiltBatchDocumentDownloadArchive> {
  const fetchDocument = dependencies.getDocument ?? getDocument;
  const listHighlightsByDocumentIds = dependencies.listExportHighlightsByDocumentIds ?? listExportHighlightsByDocumentIds;
  const now = dependencies.now ?? (() => new Date());
  const exportedAt = now().toISOString();

  const documentResults = await Promise.all(
    input.documentIds.map(async (id) => ({
      id,
      data: await fetchDocument(id),
    })),
  );

  const missingIds = documentResults.filter((result) => !result.data).map((result) => result.id);
  const documents = documentResults
    .map((result) => result.data?.document ?? null)
    .filter((document): document is NonNullable<typeof document> => Boolean(document));

  if (documents.length === 0) {
    throw new RouteError("DOCUMENT_NOT_FOUND", 404, "No exportable documents were found.");
  }

  const exportHighlights = await listHighlightsByDocumentIds(documents.map((document) => document.id));
  const highlightsByDocumentId = new Map<string, typeof exportHighlights>();

  for (const highlight of exportHighlights) {
    const existing = highlightsByDocumentId.get(highlight.documentId);
    if (existing) {
      existing.push(highlight);
      continue;
    }

    highlightsByDocumentId.set(highlight.documentId, [highlight]);
  }

  const zip = new JSZip();
  const folder = zip.folder("reader-export");

  if (!folder) {
    throw new RouteError("EXPORT_ARCHIVE_BUILD_FAILED", 500, "Failed to create export archive.");
  }

  const usedFileNames = new Set<string>();

  for (const document of documents) {
    const suggestedFileName = buildDocumentDownloadFileName(document, input.format);
    const fileName = ensureUniqueFileName(suggestedFileName, usedFileNames);
    const download = buildDocumentDownload(document, input.format, {
      exportedAt,
      highlights: (highlightsByDocumentId.get(document.id) ?? []).map((highlight) => ({
        quoteText: highlight.quoteText,
        note: highlight.note,
        color: highlight.color,
        createdAt: highlight.createdAt,
      })),
    });

    folder.file(fileName, download.content);
  }

  if (missingIds.length > 0) {
    folder.file("_export-report.md", buildMissingIdsReport(missingIds, exportedAt, input.format));
  }

  return {
    content: await zip.generateAsync({
      type: "nodebuffer",
      compression: "DEFLATE",
      compressionOptions: { level: 6 },
    }),
    exportedCount: documents.length,
    exportedAt,
    fileName: buildBatchArchiveFileName(input.format, exportedAt),
    format: input.format,
    missingIds,
  };
}

function ensureUniqueFileName(fileName: string, usedFileNames: Set<string>) {
  if (!usedFileNames.has(fileName)) {
    usedFileNames.add(fileName);
    return fileName;
  }

  const { base, extension } = splitFileName(fileName);

  let index = 2;
  while (true) {
    const nextFileName = `${base} (${index})${extension}`;
    if (!usedFileNames.has(nextFileName)) {
      usedFileNames.add(nextFileName);
      return nextFileName;
    }

    index += 1;
  }
}

function splitFileName(fileName: string) {
  const obsidianSuffix = ".obsidian.md";
  if (fileName.endsWith(obsidianSuffix)) {
    return {
      base: fileName.slice(0, -obsidianSuffix.length),
      extension: obsidianSuffix,
    };
  }

  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex === -1) {
    return {
      base: fileName,
      extension: "",
    };
  }

  return {
    base: fileName.slice(0, dotIndex),
    extension: fileName.slice(dotIndex),
  };
}

function buildMissingIdsReport(missingIds: string[], exportedAt: string, format: DocumentDownloadFormat) {
  const lines = [
    "# Reader 批量导出报告",
    "",
    `- 导出时间：${exportedAt}`,
    `- 导出格式：${format}`,
    `- 未找到文档数：${missingIds.length}`,
    "",
    "## 未找到的文档 ID",
    ...missingIds.map((id) => `- ${id}`),
    "",
  ];

  return lines.join("\n");
}

function buildBatchArchiveFileName(format: DocumentDownloadFormat, exportedAt: string) {
  const date = new Date(exportedAt);
  if (Number.isNaN(date.getTime())) {
    return `reader-batch-export-${format}.zip`;
  }

  const stamp = [
    date.getUTCFullYear(),
    padTwoDigits(date.getUTCMonth() + 1),
    padTwoDigits(date.getUTCDate()),
  ].join("") + `-${padTwoDigits(date.getUTCHours())}${padTwoDigits(date.getUTCMinutes())}${padTwoDigits(date.getUTCSeconds())}`;

  return `reader-batch-export-${format}-${stamp}.zip`;
}

function padTwoDigits(value: number) {
  return String(value).padStart(2, "0");
}
