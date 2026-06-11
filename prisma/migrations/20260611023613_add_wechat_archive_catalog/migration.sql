-- AlterEnum
ALTER TYPE "IngestionStatus" ADD VALUE 'CATALOG';

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "archivePath" TEXT;

-- CreateIndex
CREATE INDEX "Document_ingestionStatus_publishedAt_idx" ON "Document"("ingestionStatus", "publishedAt");
