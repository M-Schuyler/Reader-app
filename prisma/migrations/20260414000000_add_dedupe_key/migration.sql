-- AlterTable
ALTER TABLE "Document" ADD COLUMN "dedupeKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Document_dedupeKey_key" ON "Document"("dedupeKey");
