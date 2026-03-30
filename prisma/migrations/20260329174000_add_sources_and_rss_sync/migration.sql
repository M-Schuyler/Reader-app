CREATE TYPE "SourceKind" AS ENUM ('RSS', 'WECHAT_ARCHIVE');

CREATE TYPE "SourceSyncMode" AS ENUM ('SCHEDULED', 'MANUAL_ONLY');

CREATE TABLE "Source" (
    "id" TEXT NOT NULL,
    "kind" "SourceKind" NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "siteUrl" TEXT,
    "locatorUrl" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "syncMode" "SourceSyncMode" NOT NULL DEFAULT 'SCHEDULED',
    "backfillStartAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3),
    "lastSyncStatus" "IngestionJobStatus",
    "lastSyncError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Source_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Feed" ADD COLUMN "sourceId" TEXT;
ALTER TABLE "Document" ADD COLUMN "sourceId" TEXT;
ALTER TABLE "IngestionJob" ADD COLUMN "sourceId" TEXT;

CREATE UNIQUE INDEX "Source_slug_key" ON "Source"("slug");
CREATE INDEX "Source_kind_createdAt_idx" ON "Source"("kind", "createdAt");
CREATE INDEX "Source_isActive_syncMode_idx" ON "Source"("isActive", "syncMode");
CREATE INDEX "Source_lastSyncedAt_idx" ON "Source"("lastSyncedAt");
CREATE INDEX "Source_locatorUrl_idx" ON "Source"("locatorUrl");
CREATE UNIQUE INDEX "Feed_sourceId_key" ON "Feed"("sourceId");
CREATE INDEX "Document_sourceId_publishedAt_idx" ON "Document"("sourceId", "publishedAt");
CREATE INDEX "IngestionJob_sourceId_createdAt_idx" ON "IngestionJob"("sourceId", "createdAt");

ALTER TABLE "Feed" ADD CONSTRAINT "Feed_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Document" ADD CONSTRAINT "Document_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "IngestionJob" ADD CONSTRAINT "IngestionJob_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;
