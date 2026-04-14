import type {
  AiSummaryStatus,
  DocumentType,
  IngestionJobStatus,
  IngestionStatus,
  PublishedAtKind,
  ReadState,
  SourceKind,
} from "@prisma/client";
import type { DocumentVideoEmbed, VideoProvider } from "@/lib/documents/video-types";
export type { DocumentVideoEmbed, TranscriptSegment, VideoProvider, VideoSyncMode } from "@/lib/documents/video-types";

export type DocumentListSort = "latest" | "earliest";
export type DocumentSurface = "source" | "reading";
export type SourceAliasTargetKind = "feed" | "domain";
export type DocumentSourceFilter =
  | {
      kind: SourceAliasTargetKind;
      value: string;
    }
  | {
      kind: "unknown";
      value: null;
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
  origin?: string;
  readState?: ReadState;
  isFavorite?: boolean;
  tag?: string;
  source?: DocumentSourceFilter;
  page: number;
  pageSize: number;
  sort: DocumentListSort;
  timeRange?: "7d" | "all";
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
  author: string | null;
  videoThumbnailUrl: string | null;
  publishedAt: string | null;
  publishedAtKind: PublishedAtKind;
  enteredReadingAt: string | null;
  readState: ReadState;
  readingProgress: number;
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
    origin?: string;
    readState?: ReadState;
    isFavorite?: boolean;
    tag?: string;
    sort: DocumentListSort;
  };
  contentOrigin?: {
    options: Array<{
      value: string;
      label: string;
      count: number;
    }>;
  };
};

export type SourceLibraryIndexRow = {
  createdAt: string;
  sourceUrl: string | null;
  canonicalUrl: string | null;
  source: {
    id: string;
    title: string;
    includeCategories: string[];
  } | null;
  feed: {
    id: string;
    title: string;
  } | null;
};

export type SourceLibraryIndexGroup = {
  id: string;
  label: string;
  defaultLabel: string;
  customLabel: string | null;
  meta: string;
  host: string | null;
  latestCreatedAt: string;
  totalItems: number;
  kind: "source" | "feed" | "domain" | "unknown";
  value: string | null;
  href: string | null;
  filterSummary?: string | null;
};

export type GetSourceLibraryIndexResponseData = {
  groups: SourceLibraryIndexGroup[];
  documentCount: number;
  filters: {
    surface: "source";
    q?: string;
    type?: DocumentType;
    tag?: string;
    sort: DocumentListSort;
    timeRange?: "7d" | "all";
  };
  emptyState: "empty_library" | "no_recent_sources" | null;
};

export type DocumentDetail = {
  id: string;
  type: DocumentType;
  title: string;
  sourceUrl: string | null;
  canonicalUrl: string | null;
  videoUrl: string | null;
  videoProvider: VideoProvider | null;
  videoThumbnailUrl: string | null;
  videoDurationSeconds: number | null;
  videoEmbed: DocumentVideoEmbed | null;
  aiSummary: string | null;
  aiSummaryStatus: AiSummaryStatus | null;
  aiSummaryError: string | null;
  excerpt: string | null;
  lang: string | null;
  author: string | null;
  contentOrigin: {
    key: string;
    label: string;
  } | null;
  publishedAt: string | null;
  publishedAtKind: PublishedAtKind;
  enteredReadingAt: string | null;
  readState: ReadState;
  readingProgress: number;
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
  ingestion?: {
    error: CaptureIngestionError | null;
  };
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

export type GetReaderDocumentResponseData = {
  document: DocumentDetail;
  nextUp: DocumentListItem | null;
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

export type SummaryQueueStatusResponseData = {
  pendingCount: number;
  isAvailable: boolean;
  throttle: SummaryRunnerThrottle | null;
};

export type UpdateDocumentFavoriteInput = {
  isFavorite: boolean;
  regenerateAiSummary?: boolean;
};

export type UpdateDocumentReadStateInput = {
  readState: ReadState;
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

export type UpdateDocumentReadStateResponseData = {
  document: DocumentDetail;
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
  type: DocumentType;
  title: string;
  author: string | null;
  sourceUrl: string | null;
  canonicalUrl: string | null;
  aiSummary: string | null;
  excerpt: string | null;
  wordCount: number | null;
  publishedAt: string | null;
  publishedAtKind: PublishedAtKind;
  readState: ReadState;
  ingestionStatus: IngestionStatus;
  tags: DocumentTagLabel[];
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
