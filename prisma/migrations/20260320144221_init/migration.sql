-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('RSS_ITEM', 'WEB_PAGE', 'PDF');

-- CreateEnum
CREATE TYPE "ReadState" AS ENUM ('UNREAD', 'READING', 'READ');

-- CreateEnum
CREATE TYPE "IngestionStatus" AS ENUM ('PENDING', 'PROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "IngestionJobKind" AS ENUM ('FETCH_WEB_PAGE', 'IMPORT_FEED_ITEM', 'EXTRACT_PDF_TEXT', 'SYNC_FEED');

-- CreateEnum
CREATE TYPE "IngestionJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "Feed" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "feedUrl" TEXT NOT NULL,
    "siteUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Feed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "title" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "canonicalUrl" TEXT,
    "externalId" TEXT,
    "lang" TEXT,
    "excerpt" TEXT,
    "author" TEXT,
    "publishedAt" TIMESTAMP(3),
    "readState" "ReadState" NOT NULL DEFAULT 'UNREAD',
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "isLater" BOOLEAN NOT NULL DEFAULT false,
    "ingestionStatus" "IngestionStatus" NOT NULL DEFAULT 'PENDING',
    "feedId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentContent" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "contentHtml" TEXT,
    "plainText" TEXT NOT NULL,
    "rawHtml" TEXT,
    "textHash" TEXT,
    "wordCount" INTEGER,
    "extractedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentFile" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksum" TEXT NOT NULL,
    "pageCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentTag" (
    "documentId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentTag_pkey" PRIMARY KEY ("documentId","tagId")
);

-- CreateTable
CREATE TABLE "Highlight" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "quoteText" TEXT NOT NULL,
    "note" TEXT,
    "color" TEXT,
    "startOffset" INTEGER,
    "endOffset" INTEGER,
    "selectorJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Highlight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IngestionJob" (
    "id" TEXT NOT NULL,
    "kind" "IngestionJobKind" NOT NULL,
    "status" "IngestionJobStatus" NOT NULL DEFAULT 'PENDING',
    "documentId" TEXT,
    "feedId" TEXT,
    "sourceUrl" TEXT,
    "payloadJson" JSONB,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IngestionJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Feed_isActive_idx" ON "Feed"("isActive");

-- CreateIndex
CREATE INDEX "Feed_lastSyncedAt_idx" ON "Feed"("lastSyncedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Feed_feedUrl_key" ON "Feed"("feedUrl");

-- CreateIndex
CREATE INDEX "Document_type_createdAt_idx" ON "Document"("type", "createdAt");

-- CreateIndex
CREATE INDEX "Document_readState_createdAt_idx" ON "Document"("readState", "createdAt");

-- CreateIndex
CREATE INDEX "Document_isFavorite_createdAt_idx" ON "Document"("isFavorite", "createdAt");

-- CreateIndex
CREATE INDEX "Document_isLater_createdAt_idx" ON "Document"("isLater", "createdAt");

-- CreateIndex
CREATE INDEX "Document_feedId_publishedAt_idx" ON "Document"("feedId", "publishedAt");

-- CreateIndex
CREATE INDEX "Document_canonicalUrl_idx" ON "Document"("canonicalUrl");

-- CreateIndex
CREATE INDEX "Document_sourceUrl_idx" ON "Document"("sourceUrl");

-- CreateIndex
CREATE UNIQUE INDEX "Document_feedId_externalId_key" ON "Document"("feedId", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentContent_documentId_key" ON "DocumentContent"("documentId");

-- CreateIndex
CREATE INDEX "DocumentContent_textHash_idx" ON "DocumentContent"("textHash");

-- CreateIndex
CREATE INDEX "DocumentContent_extractedAt_idx" ON "DocumentContent"("extractedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentFile_documentId_key" ON "DocumentFile"("documentId");

-- CreateIndex
CREATE INDEX "DocumentFile_mimeType_idx" ON "DocumentFile"("mimeType");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentFile_checksum_key" ON "DocumentFile"("checksum");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

-- CreateIndex
CREATE INDEX "DocumentTag_tagId_documentId_idx" ON "DocumentTag"("tagId", "documentId");

-- CreateIndex
CREATE INDEX "Highlight_documentId_createdAt_idx" ON "Highlight"("documentId", "createdAt");

-- CreateIndex
CREATE INDEX "IngestionJob_kind_status_createdAt_idx" ON "IngestionJob"("kind", "status", "createdAt");

-- CreateIndex
CREATE INDEX "IngestionJob_documentId_createdAt_idx" ON "IngestionJob"("documentId", "createdAt");

-- CreateIndex
CREATE INDEX "IngestionJob_feedId_createdAt_idx" ON "IngestionJob"("feedId", "createdAt");

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_feedId_fkey" FOREIGN KEY ("feedId") REFERENCES "Feed"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentContent" ADD CONSTRAINT "DocumentContent_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentFile" ADD CONSTRAINT "DocumentFile_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentTag" ADD CONSTRAINT "DocumentTag_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentTag" ADD CONSTRAINT "DocumentTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Highlight" ADD CONSTRAINT "Highlight_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestionJob" ADD CONSTRAINT "IngestionJob_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IngestionJob" ADD CONSTRAINT "IngestionJob_feedId_fkey" FOREIGN KEY ("feedId") REFERENCES "Feed"("id") ON DELETE SET NULL ON UPDATE CASCADE;
