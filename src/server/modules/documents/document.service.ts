import { DocumentType, ReadState } from "@prisma/client";
import { RouteError } from "@/server/api/response";
import { buildSourceAliasMap } from "@/lib/documents/source-library";
import { mapDocumentDetail, mapDocumentListItem } from "./document.mapper";
import {
  deleteDocumentById,
  deleteSourceAlias,
  getDocumentById,
  listQuickSearchDocuments,
  listDocuments,
  listSourceAliases,
  markDocumentEnteredReading,
  upsertSourceAlias,
  updateDocumentFavorite,
} from "./document.repository";
import type {
  DeleteDocumentResponseData,
  DocumentListQuery,
  DocumentListSort,
  DocumentSurface,
  DocumentSourceFilter,
  GenerateAiSummaryError,
  GetDocumentResponseData,
  GetDocumentsResponseData,
  QuickSearchResponseData,
  SourceAliasTargetKind,
  UpdateSourceAliasInput,
  UpdateSourceAliasResponseData,
  UpdateDocumentFavoriteInput,
  UpdateDocumentFavoriteResponseData,
} from "./document.types";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

export async function getDocuments(query: DocumentListQuery): Promise<GetDocumentsResponseData> {
  const { items, total } = await listDocuments(query);

  return {
    items: items.map(mapDocumentListItem),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    },
    filters: {
      surface: query.surface,
      q: query.q,
      type: query.type,
      readState: query.readState,
      isFavorite: query.isFavorite,
      tag: query.tag,
      sort: query.sort,
    },
  };
}

export async function getDocument(id: string): Promise<GetDocumentResponseData | null> {
  const document = await getDocumentById(id);

  if (!document) {
    return null;
  }

  return {
    document: mapDocumentDetail(document),
  };
}

export async function openDocument(id: string): Promise<GetDocumentResponseData | null> {
  const existing = await getDocumentById(id);

  if (!existing) {
    return null;
  }

  if (!existing.enteredReadingAt) {
    await markDocumentEnteredReading(id).catch(() => undefined);
  }

  const document = await getDocumentById(id);

  if (!document) {
    return null;
  }

  return {
    document: mapDocumentDetail(document),
  };
}

export async function getQuickSearchResults(query: string): Promise<QuickSearchResponseData> {
  const q = query.trim();

  if (!q) {
    return {
      q: "",
      items: [],
    };
  }

  const items = await listQuickSearchDocuments(q);

  return {
    q,
    items: items.map(mapDocumentListItem).map((item) => ({
      id: item.id,
      title: item.title,
      sourceUrl: item.sourceUrl,
      canonicalUrl: item.canonicalUrl,
      aiSummary: item.aiSummary,
      excerpt: item.excerpt,
      publishedAt: item.publishedAt,
      publishedAtKind: item.publishedAtKind,
      readState: item.readState,
      ingestionStatus: item.ingestionStatus,
    })),
  };
}

export async function updateDocumentFavoriteStatus(
  id: string,
  input: UpdateDocumentFavoriteInput,
): Promise<UpdateDocumentFavoriteResponseData | null> {
  const existingDocument = await getDocumentById(id);

  if (!existingDocument) {
    return null;
  }

  const document =
    existingDocument.isFavorite === input.isFavorite ? existingDocument : await updateDocumentFavorite(id, input.isFavorite);

  if (!input.isFavorite) {
    return {
      document: mapDocumentDetail(document),
      summary: {
        status: "not_requested",
        source: null,
        error: null,
      },
    };
  }

  return {
    document: mapDocumentDetail(document),
    summary: {
      status: "not_requested",
      source: null,
      error: null,
    },
  };
}

export async function deleteDocument(id: string): Promise<DeleteDocumentResponseData | null> {
  const existingDocument = await getDocumentById(id);

  if (!existingDocument) {
    return null;
  }

  const deleted = await deleteDocumentById(id);
  return deleted;
}

export async function getSourceAliasMapForSources(sources: DocumentSourceFilter[]) {
  const normalizedSources = dedupeSourceInputs(sources);
  if (normalizedSources.length === 0) {
    return {};
  }

  const aliases = await listSourceAliases(normalizedSources);
  return buildSourceAliasMap(
    aliases.map((alias) => ({
      kind: fromPersistedSourceAliasKind(alias.kind),
      name: alias.name,
      value: alias.value,
    })),
  );
}

export async function updateSourceAliasName(
  input: UpdateSourceAliasInput,
): Promise<UpdateSourceAliasResponseData> {
  if (input.name === null) {
    await deleteSourceAlias(input);

    return {
      alias: null,
    };
  }

  const alias = await upsertSourceAlias({
    kind: input.kind,
    value: input.value,
    name: input.name,
  });

  return {
    alias: {
      kind: fromPersistedSourceAliasKind(alias.kind),
      value: alias.value,
      name: alias.name,
    },
  };
}

export function parseDocumentListQuery(searchParams: URLSearchParams): DocumentListQuery {
  return {
    surface: parseDocumentSurface(searchParams.get("surface")),
    q: parseOptionalString(searchParams.get("q")),
    type: parseDocumentType(searchParams.get("type")),
    readState: parseReadState(searchParams.get("readState")),
    isFavorite: parseOptionalBoolean(searchParams.get("isFavorite")),
    tag: parseOptionalString(searchParams.get("tag")),
    page: parsePositiveInt(searchParams.get("page"), DEFAULT_PAGE),
    pageSize: parsePositiveInt(searchParams.get("pageSize"), DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE),
    sort: parseDocumentSort(searchParams.get("sort")),
  };
}

export function parseUpdateDocumentFavoriteInput(body: unknown): UpdateDocumentFavoriteInput {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new RouteError("INVALID_BODY", 400, "Request body must be a JSON object.");
  }

  const isFavorite = (body as { isFavorite?: unknown }).isFavorite;
  const regenerateAiSummary = (body as { regenerateAiSummary?: unknown }).regenerateAiSummary;

  if (typeof isFavorite !== "boolean") {
    throw new RouteError("INVALID_BODY", 400, '"isFavorite" must be a boolean.');
  }

  if (typeof regenerateAiSummary !== "undefined" && typeof regenerateAiSummary !== "boolean") {
    throw new RouteError("INVALID_BODY", 400, '"regenerateAiSummary" must be a boolean when provided.');
  }

  return {
    isFavorite,
    regenerateAiSummary,
  };
}

export function parseUpdateSourceAliasInput(body: unknown): UpdateSourceAliasInput {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new RouteError("INVALID_BODY", 400, "Request body must be a JSON object.");
  }

  const kind = (body as { kind?: unknown }).kind;
  const value = (body as { value?: unknown }).value;
  const name = (body as { name?: unknown }).name;

  if (kind !== "feed" && kind !== "domain") {
    throw new RouteError("INVALID_BODY", 400, '"kind" must be "feed" or "domain".');
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    throw new RouteError("INVALID_BODY", 400, '"value" must be a non-empty string.');
  }

  if (typeof name !== "string" && name !== null) {
    throw new RouteError("INVALID_BODY", 400, '"name" must be a string or null.');
  }

  const trimmedName = typeof name === "string" ? name.trim() : null;

  return {
    kind,
    value: value.trim(),
    name: trimmedName && trimmedName.length > 0 ? trimmedName : null,
  };
}

function parseOptionalString(value: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function parseOptionalBoolean(value: string | null) {
  if (!value) {
    return undefined;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new RouteError("INVALID_QUERY", 400, `Boolean query parameter "${value}" is invalid.`);
}

function parsePositiveInt(value: string | null, fallback: number, max?: number) {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  if (Number.isNaN(parsed) || parsed < 1) {
    throw new RouteError("INVALID_QUERY", 400, `Numeric query parameter "${value}" is invalid.`);
  }

  if (max) {
    return Math.min(parsed, max);
  }

  return parsed;
}

function parseDocumentType(value: string | null) {
  if (!value) {
    return undefined;
  }

  if (Object.values(DocumentType).includes(value as DocumentType)) {
    return value as DocumentType;
  }

  throw new RouteError("INVALID_QUERY", 400, `Document type "${value}" is invalid.`);
}

function parseReadState(value: string | null) {
  if (!value) {
    return undefined;
  }

  if (Object.values(ReadState).includes(value as ReadState)) {
    return value as ReadState;
  }

  throw new RouteError("INVALID_QUERY", 400, `Read state "${value}" is invalid.`);
}

function parseDocumentSort(value: string | null): DocumentListSort {
  if (!value) {
    return "latest";
  }

  if (value === "newest" || value === "published") {
    return "latest";
  }

  if (value === "oldest") {
    return "earliest";
  }

  if (value === "latest" || value === "earliest") {
    return value;
  }

  throw new RouteError("INVALID_QUERY", 400, `Sort "${value}" is invalid.`);
}

function parseDocumentSurface(value: string | null): DocumentSurface {
  if (!value) {
    return "source";
  }

  if (value === "source" || value === "reading") {
    return value;
  }

  throw new RouteError("INVALID_QUERY", 400, `Surface "${value}" is invalid.`);
}

function dedupeSourceInputs(sources: DocumentSourceFilter[]) {
  const unique = new Map<string, DocumentSourceFilter>();

  for (const source of sources) {
    const key = `${source.kind}:${source.value}`;
    unique.set(key, source);
  }

  return [...unique.values()];
}

function fromPersistedSourceAliasKind(kind: "FEED" | "DOMAIN"): SourceAliasTargetKind {
  return kind === "FEED" ? "feed" : "domain";
}
