import type {
  AiSummaryStatus,
  DocumentType,
  IngestionJobStatus,
  IngestionStatus,
  PublishedAtKind,
  ReadState,
  SourceKind,
} from "@prisma/client";

export type DocumentListSort = "latest" | "earliest";
export type DocumentSurface = "source" | "reading";
export type SourceAliasTargetKind = "feed" | "domain";
export type DocumentSourceFilter = {
  kind: SourceAliasTargetKind;
  value: string;
};

export type DocumentTagLabel = {
  name: string;
  slug: string;
};

export type DocumentListQuery = {
  surface: DocumentSurface;
  sourceId?: string;
  q?: string;
  type?: DocumentType;
  readState?: ReadState;
  isFavorite?: boolean;
  tag?: string;
  source?: DocumentSourceFilter;
  page: number;
  pageSize: number;
  sort: DocumentListSort;
};

export type DocumentListItem = {
  id: string;
  type: DocumentType;
  title: string;
  sourceUrl: string | null;
  canonicalUrl: string | null;
  aiSummary: string | null;
  aiSummaryStatus: AiSummaryStatus | null;
  aiSummaryError: string | null;
  excerpt: string | null;
  lang: string | null;
  publishedAt: string | null;
  publishedAtKind: PublishedAtKind;
  enteredReadingAt: string | null;
  readState: ReadState;
  isFavorite: boolean;
  ingestionStatus: IngestionStatus;
  createdAt: string;
  updatedAt: string;
  wordCount: number | null;
  tags: DocumentTagLabel[];
  source: {
    id: string;
    title: string;
    kind: SourceKind;
    siteUrl: string | null;
    locatorUrl: string;
    includeCategories: string[];
    lastSyncedAt: string | null;
    lastSyncStatus: IngestionJobStatus | null;
  } | null;
  feed: {
    id: string;
    title: string;
  } | null;
};

export type GetDocumentsResponseData = {
  items: DocumentListItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  filters: {
    surface: DocumentSurface;
    q?: string;
    type?: DocumentType;
    readState?: ReadState;
    isFavorite?: boolean;
    tag?: string;
    sort: DocumentListSort;
  };
};

export type DocumentDetail = {
  id: string;
  type: DocumentType;
  title: string;
  sourceUrl: string | null;
  canonicalUrl: string | null;
  aiSummary: string | null;
  aiSummaryStatus: AiSummaryStatus | null;
  aiSummaryError: string | null;
  excerpt: string | null;
  lang: string | null;
  author: string | null;
  publishedAt: string | null;
  publishedAtKind: PublishedAtKind;
  enteredReadingAt: string | null;
  readState: ReadState;
  isFavorite: boolean;
  ingestionStatus: IngestionStatus;
  createdAt: string;
  updatedAt: string;
  tags: DocumentTagLabel[];
  source: {
    id: string;
    title: string;
    kind: SourceKind;
    siteUrl: string | null;
    locatorUrl: string;
    includeCategories: string[];
    lastSyncedAt: string | null;
    lastSyncStatus: IngestionJobStatus | null;
  } | null;
  feed: {
    id: string;
    title: string;
    feedUrl: string;
    siteUrl: string | null;
  } | null;
  file: {
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    pageCount: number | null;
  } | null;
  content: {
    contentHtml: string | null;
    plainText: string;
    wordCount: number | null;
    extractedAt: string | null;
  } | null;
};

export type GetDocumentResponseData = {
  document: DocumentDetail;
};

export type CaptureIngestionError = {
  code: string;
  message: string;
};

export type AiSummarySource = "content" | "excerpt" | "metadata";

export type GenerateAiSummaryError = {
  code: string;
  message: string;
  retryAfterMs?: number;
};

export type SummaryRunnerThrottle = {
  reason: "rate_limited" | "runner_busy";
  retryAfterMs: number;
  cooldownUntil: string | null;
};

export type UpdateDocumentFavoriteInput = {
  isFavorite: boolean;
  regenerateAiSummary?: boolean;
};

export type UpdateSourceAliasInput = {
  kind: SourceAliasTargetKind;
  value: string;
  name: string | null;
};

export type UpdateDocumentFavoriteResponseData = {
  document: DocumentDetail;
  summary: {
    status: "generated" | "skipped" | "failed" | "not_requested";
    source: AiSummarySource | null;
    error: GenerateAiSummaryError | null;
  };
};

export type UpdateSourceAliasResponseData = {
  alias: {
    kind: SourceAliasTargetKind;
    value: string;
    name: string;
  } | null;
};

export type DeleteDocumentResponseData = {
  id: string;
};

export type CaptureUrlResponseData = {
  document: DocumentDetail;
  deduped: boolean;
  jobId: string | null;
  ingestion: {
    error: CaptureIngestionError | null;
  };
};

export type QuickSearchResult = {
  id: string;
  title: string;
  sourceUrl: string | null;
  canonicalUrl: string | null;
  aiSummary: string | null;
  excerpt: string | null;
  publishedAt: string | null;
  publishedAtKind: PublishedAtKind;
  readState: ReadState;
  ingestionStatus: IngestionStatus;
};

export type QuickSearchResponseData = {
  q: string;
  items: QuickSearchResult[];
};

export type RunDocumentAiSummaryJobsResponseData = {
  processed: number;
  generated: number;
  failed: number;
  skipped: number;
  deferred: number;
  throttle: SummaryRunnerThrottle | null;
  results: Array<{
    jobId: string;
    documentId: string | null;
    outcome: "generated" | "failed" | "skipped" | "deferred";
    error: GenerateAiSummaryError | null;
  }>;
};

export type SweepDocumentAiSummaryJobsResponseData = {
  runs: number;
  processed: number;
  generated: number;
  failed: number;
  skipped: number;
  deferred: number;
  waitedMs: number;
  completed: boolean;
  stopReason: "queue_empty" | "rate_limited" | "runner_busy" | "time_budget_exhausted" | "max_runs_reached";
  throttle: SummaryRunnerThrottle | null;
};

export type BackfillDocumentAiSummaryJobsResponseData = {
  scanned: number;
  queued: number;
  skipped: number;
  documentIds: string[];
};

export type PrioritizeDocumentAiSummaryResponseData = {
  document: DocumentDetail;
  summary: {
    status: "generated" | "queued" | "skipped" | "blocked" | "failed";
    error: GenerateAiSummaryError | null;
    throttle: SummaryRunnerThrottle | null;
    runtimeIssues: string[];
  };
};
