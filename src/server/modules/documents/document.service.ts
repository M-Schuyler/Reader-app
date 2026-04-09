import { DocumentType, ReadState } from "@prisma/client";
import { RouteError } from "@/server/api/response";
import { buildSourceAliasMap, buildSourceLibraryIndexGroups, collectSourceAliasLookups } from "@/lib/documents/source-library";
import { mapDocumentDetail, mapDocumentListItem } from "./document.mapper";
import {
  getSummaryQueueStatus,
  getSummaryRuntimeIssues,
  prioritizeDocumentAiSummary,
  sweepPendingDocumentAiSummaryJobs,
} from "./document-ai-summary-jobs.service";
import {
  deleteDocumentById,
  deleteSourceAlias,
  type DocumentDetailRecord,
  findLatestCaptureErrorForDocument,
  getDocumentById,
  listSourceIndexRows,
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
  GetSourceLibraryIndexResponseData,
  PrioritizeDocumentAiSummaryResponseData,
  QuickSearchResponseData,
  SummaryQueueStatusResponseData,
  SourceAliasTargetKind,
  SweepDocumentAiSummaryJobsResponseData,
  UpdateSourceAliasInput,
  UpdateSourceAliasResponseData,
  UpdateDocumentFavoriteInput,
  UpdateDocumentFavoriteResponseData,
} from "./document.types";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const MANUAL_SUMMARY_QUEUE_SWEEP_LIMIT = 3;
const MANUAL_SUMMARY_QUEUE_SWEEP_MAX_RUNS = 4;
const MANUAL_SUMMARY_QUEUE_SWEEP_MAX_RUNTIME_MS = 12_000;
export const SOURCE_INDEX_APP_AGGREGATION_WARN_THRESHOLD = 2000;

type DocumentDetailDependencies = {
  getDocumentById?: typeof getDocumentById;
  markDocumentEnteredReading?: typeof markDocumentEnteredReading;
  getLatestCaptureError?: typeof findLatestCaptureErrorForDocument;
};

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

type SourceLibraryIndexDependencies = {
  listSourceIndexRows?: typeof listSourceIndexRows;
  getSourceAliasMapForSources?: typeof getSourceAliasMapForSources;
  now?: () => Date;
  warn?: (...args: unknown[]) => void;
};

export async function getSourceLibraryIndex(
  query: DocumentListQuery,
  dependencies: SourceLibraryIndexDependencies = {},
): Promise<GetSourceLibraryIndexResponseData> {
  const listRows = dependencies.listSourceIndexRows ?? listSourceIndexRows;
  const getAliasMap = dependencies.getSourceAliasMapForSources ?? getSourceAliasMapForSources;
  const now = dependencies.now ?? (() => new Date());
  const warn = dependencies.warn ?? console.warn;

  const { rows, total } = await listRows(query);

  if (total > SOURCE_INDEX_APP_AGGREGATION_WARN_THRESHOLD) {
    warn(
      `[SourceLibraryIndex] matchedDocumentCount=${total}; database-level source index aggregation should be the next optimization step.`,
    );
  }

  const aliasMap = await getAliasMap(collectSourceAliasLookups(rows));
  const groups = buildSourceLibraryIndexGroups(rows, now(), aliasMap, query.sort);

  return {
    groups,
    documentCount: total,
    filters: {
      surface: "source",
      q: query.q,
      type: query.type,
      tag: query.tag,
      sort: query.sort,
    },
    emptyState: total === 0 ? "empty_library" : groups.length === 0 ? "no_recent_sources" : null,
  };
}

export async function getDocument(id: string, dependencies: DocumentDetailDependencies = {}): Promise<GetDocumentResponseData | null> {
  const fetchDocument = dependencies.getDocumentById ?? getDocumentById;
  const document = await fetchDocument(id);

  if (!document) {
    return null;
  }

  return buildDocumentDetailResponse(document, dependencies);
}

export async function openDocument(id: string, dependencies: DocumentDetailDependencies = {}): Promise<GetDocumentResponseData | null> {
  const fetchDocument = dependencies.getDocumentById ?? getDocumentById;
  const markOpened = dependencies.markDocumentEnteredReading ?? markDocumentEnteredReading;
  const existing = await fetchDocument(id);

  if (!existing) {
    return null;
  }

  if (!existing.enteredReadingAt) {
    await markOpened(id).catch(() => undefined);
  }

  const document = await fetchDocument(id);

  if (!document) {
    return null;
  }

  return buildDocumentDetailResponse(document, dependencies);
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

export async function prioritizeDocumentAiSummaryForReader(
  id: string,
): Promise<PrioritizeDocumentAiSummaryResponseData | null> {
  const result = await prioritizeDocumentAiSummary(id);

  if (!result) {
    return null;
  }

  return {
    document: mapDocumentDetail(result.document),
    summary: result.summary,
  };
}

async function buildDocumentDetailResponse(
  document: DocumentDetailRecord,
  dependencies: DocumentDetailDependencies,
): Promise<GetDocumentResponseData> {
  const getLatestCaptureError = dependencies.getLatestCaptureError ?? findLatestCaptureErrorForDocument;
  const ingestionError = await getLatestCaptureError(document);

  return {
    document: mapDocumentDetail(document, {
      ingestionError,
    }),
  };
}

export async function getSummaryQueueStatusForReader(): Promise<SummaryQueueStatusResponseData> {
  return getSummaryQueueStatus();
}

export async function sweepSummaryQueueForReader(): Promise<SweepDocumentAiSummaryJobsResponseData> {
  const runtimeIssues = getSummaryRuntimeIssues({ requireInternalApiSecret: false });
  if (runtimeIssues.length > 0) {
    throw new RouteError("AI_SUMMARY_UNAVAILABLE", 409, "AI 摘要当前不可用。");
  }

  return sweepPendingDocumentAiSummaryJobs({
    limit: MANUAL_SUMMARY_QUEUE_SWEEP_LIMIT,
    maxRuns: MANUAL_SUMMARY_QUEUE_SWEEP_MAX_RUNS,
    maxRuntimeMs: MANUAL_SUMMARY_QUEUE_SWEEP_MAX_RUNTIME_MS,
  });
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

export const __documentQueryParsersForTests = {
  parseDocumentSort,
  parseDocumentSurface,
  parseDocumentType,
  parseReadState,
  parsePositiveInt,
  parseOptionalBoolean,
};

function dedupeSourceInputs(sources: DocumentSourceFilter[]) {
  const unique = new Map<string, Extract<DocumentSourceFilter, { value: string }>>();

  for (const source of sources) {
    if (source.kind === "unknown" || source.value === null) {
      continue;
    }

    const key = `${source.kind}:${source.value}`;
    unique.set(key, source);
  }

  return [...unique.values()];
}

function fromPersistedSourceAliasKind(kind: "FEED" | "DOMAIN"): SourceAliasTargetKind {
  return kind === "FEED" ? "feed" : "domain";
}
