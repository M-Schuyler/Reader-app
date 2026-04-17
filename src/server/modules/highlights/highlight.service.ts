import { IngestionStatus, Prisma, type Prisma as PrismaTypes } from "@prisma/client";
import { RouteError } from "@/server/api/response";
import {
  createHighlight,
  deleteHighlight,
  getHighlightableDocumentById,
  getHighlightById,
  listHighlightsByDocumentId,
  updateHighlight,
} from "./highlight.repository";
import type {
  CreateHighlightInput,
  GetDocumentHighlightsResponseData,
  HighlightMutationResponseData,
  HighlightRecord,
  UpdateHighlightInput,
} from "./highlight.types";

export function shouldAllowHighlightCreation(input: {
  ingestionStatus: IngestionStatus;
  hasContent: boolean;
}) {
  return input.ingestionStatus === IngestionStatus.READY && input.hasContent;
}

export function parseCreateHighlightInput(body: unknown): CreateHighlightInput {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new RouteError("INVALID_BODY", 400, "Highlight payload must be a JSON object.");
  }

  const quoteText = normalizeRequiredString((body as { quoteText?: unknown }).quoteText, "quoteText");
  const note = normalizeNullableString((body as { note?: unknown }).note, "note");
  const color = normalizeNullableString((body as { color?: unknown }).color, "color");
  const startOffset = normalizeNullableNumber((body as { startOffset?: unknown }).startOffset, "startOffset");
  const endOffset = normalizeNullableNumber((body as { endOffset?: unknown }).endOffset, "endOffset");
  const selectorJson = normalizeNullableJson((body as { selectorJson?: unknown }).selectorJson);

  if ((startOffset === null) !== (endOffset === null)) {
    throw new RouteError("INVALID_BODY", 400, '"startOffset" and "endOffset" must be provided together.');
  }

  if (startOffset !== null && endOffset !== null && startOffset >= endOffset) {
    throw new RouteError("INVALID_BODY", 400, "Highlight offset range is invalid.");
  }

  return {
    quoteText,
    note,
    color,
    startOffset,
    endOffset,
    selectorJson,
  };
}

export function parseUpdateHighlightInput(body: unknown): UpdateHighlightInput {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new RouteError("INVALID_BODY", 400, "Highlight update payload must be a JSON object.");
  }

  const note = normalizeNullableString((body as { note?: unknown }).note, "note");
  const color = normalizeNullableString((body as { color?: unknown }).color, "color");

  if (typeof note === "undefined" && typeof color === "undefined") {
    throw new RouteError("INVALID_BODY", 400, "Provide at least one editable highlight field.");
  }

  return {
    ...(typeof note !== "undefined" ? { note } : {}),
    ...(typeof color !== "undefined" ? { color } : {}),
  };
}

export function mapHighlightRecord(record: {
  id: string;
  documentId: string;
  quoteText: string;
  note: string | null;
  color: string | null;
  startOffset: number | null;
  endOffset: number | null;
  selectorJson: PrismaTypes.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
}): HighlightRecord {
  return {
    id: record.id,
    documentId: record.documentId,
    quoteText: record.quoteText,
    note: record.note,
    color: record.color,
    startOffset: record.startOffset,
    endOffset: record.endOffset,
    selectorJson: record.selectorJson,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export async function getDocumentHighlights(documentId: string): Promise<GetDocumentHighlightsResponseData> {
  const items = await listHighlightsByDocumentId(documentId);

  return {
    items: items.map(mapHighlightRecord),
  };
}

export async function addDocumentHighlight(
  documentId: string,
  input: CreateHighlightInput,
): Promise<HighlightMutationResponseData | null> {
  const document = await getHighlightableDocumentById(documentId);

  if (!document) {
    return null;
  }

  const hasContent = Boolean(document.content);

  if (!shouldAllowHighlightCreation({ ingestionStatus: document.ingestionStatus, hasContent })) {
    throw new RouteError("DOCUMENT_NOT_HIGHLIGHTABLE", 409, "Highlights are only available for readable documents.");
  }

  const highlight = await createHighlight({
    documentId,
    quoteText: input.quoteText,
    note: input.note ?? null,
    color: input.color ?? null,
    startOffset: input.startOffset ?? null,
    endOffset: input.endOffset ?? null,
    selectorJson: input.selectorJson ?? Prisma.JsonNull,
  });

  return {
    highlight: mapHighlightRecord(highlight),
  };
}

export async function editHighlight(id: string, input: UpdateHighlightInput): Promise<HighlightMutationResponseData | null> {
  const existingHighlight = await getHighlightById(id);

  if (!existingHighlight) {
    return null;
  }

  const highlight = await updateHighlight(id, {
    ...(typeof input.note !== "undefined" ? { note: input.note } : {}),
    ...(typeof input.color !== "undefined" ? { color: input.color } : {}),
  });

  return {
    highlight: mapHighlightRecord(highlight),
  };
}

export async function removeHighlight(id: string) {
  const existingHighlight = await getHighlightById(id);

  if (!existingHighlight) {
    return null;
  }

  await deleteHighlight(id);

  return {
    id,
  };
}

function normalizeRequiredString(value: unknown, fieldName: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new RouteError("INVALID_BODY", 400, `"${fieldName}" must be a non-empty string.`);
  }

  return value.trim();
}

function normalizeNullableString(value: unknown, fieldName: string) {
  if (typeof value === "undefined") {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new RouteError("INVALID_BODY", 400, `"${fieldName}" must be a string or null.`);
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeNullableNumber(value: unknown, fieldName: string) {
  if (typeof value === "undefined" || value === null) {
    return null;
  }

  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new RouteError("INVALID_BODY", 400, `"${fieldName}" must be a non-negative integer or null.`);
  }

  return value;
}

function normalizeNullableJson(value: unknown) {
  if (typeof value === "undefined" || value === null) {
    return null;
  }

  return value as Prisma.JsonValue;
}
