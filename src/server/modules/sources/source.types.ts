import type { IngestionJobStatus, SourceKind, SourceSyncMode } from "@prisma/client";

export type SourceSummary = {
  id: string;
  kind: SourceKind;
  title: string;
  slug: string;
  siteUrl: string | null;
  locatorUrl: string;
  includeCategories: string[];
  isActive: boolean;
  syncMode: SourceSyncMode;
  backfillStartAt: string | null;
  lastSyncedAt: string | null;
  lastSyncStatus: IngestionJobStatus | null;
  lastSyncError: string | null;
  documentCount: number;
  createdAt: string;
  updatedAt: string;
  feed: {
    id: string;
    title: string;
    feedUrl: string;
    siteUrl: string | null;
    lastSyncedAt: string | null;
  } | null;
};

export type SourceSyncError = {
  code: string;
  message: string;
};

export type SourceSyncResult = {
  jobId: string;
  importedCount: number;
  skippedCount: number;
  failedCount: number;
  dedupedByExternalIdCount: number;
  dedupedByUrlCount: number;
  dedupedByContentCount: number;
  error: SourceSyncError | null;
};

export type CreateSourceInput = {
  kind: SourceKind;
  title: string;
  locatorUrl: string;
  backfillStartAt: string | null;
  includeCategories: string[];
};

export type CreateSourceResponseData = {
  source: SourceSummary;
  deduped: boolean;
  sync: SourceSyncResult | null;
};

export type GetSourcesResponseData = {
  items: SourceSummary[];
};

export type GetSourceResponseData = {
  source: SourceSummary;
};

export type SyncSourceResponseData = {
  source: SourceSummary;
  sync: SourceSyncResult;
};

export type RunSourceSyncsResponseData = {
  processed: number;
  succeeded: number;
  failed: number;
  skipped: number;
  results: Array<{
    sourceId: string;
    title: string;
    sync: SourceSyncResult | null;
  }>;
};
