import type { AiSummaryStatus, DocumentType, IngestionStatus, PublishedAtKind, ReadState } from "@prisma/client";

export type DocumentListSort = "latest" | "earliest";
export type DocumentSurface = "source" | "reading";

export type DocumentListQuery = {
  surface: DocumentSurface;
  q?: string;
  type?: DocumentType;
  readState?: ReadState;
  isFavorite?: boolean;
  tag?: string;
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
};

export type UpdateDocumentFavoriteInput = {
  isFavorite: boolean;
  regenerateAiSummary?: boolean;
};

export type UpdateDocumentFavoriteResponseData = {
  document: DocumentDetail;
  summary: {
    status: "generated" | "skipped" | "failed" | "not_requested";
    source: AiSummarySource | null;
    error: GenerateAiSummaryError | null;
  };
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
  results: Array<{
    jobId: string;
    documentId: string | null;
    outcome: "generated" | "failed" | "skipped";
    error: GenerateAiSummaryError | null;
  }>;
};

export type BackfillDocumentAiSummaryJobsResponseData = {
  scanned: number;
  queued: number;
  skipped: number;
  documentIds: string[];
};
