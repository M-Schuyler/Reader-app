-- CreateEnum
CREATE TYPE "PublishedAtKind" AS ENUM ('EXACT', 'BEFORE', 'UNKNOWN');

-- DropIndex
DROP INDEX "Document_isLater_createdAt_idx";

-- AlterTable
ALTER TABLE "Document"
ADD COLUMN     "enteredReadingAt" TIMESTAMP(3),
ADD COLUMN     "publishedAtKind" "PublishedAtKind" NOT NULL DEFAULT 'UNKNOWN';

-- Backfill existing documents so current libraries remain visible in Reading
UPDATE "Document"
SET "enteredReadingAt" = "createdAt"
WHERE "enteredReadingAt" IS NULL;

-- Preserve exact published timestamps already present before the reframe
UPDATE "Document"
SET "publishedAtKind" = CASE
  WHEN "publishedAt" IS NULL THEN 'UNKNOWN'::"PublishedAtKind"
  ELSE 'EXACT'::"PublishedAtKind"
END;

-- Remove deprecated queue flag
ALTER TABLE "Document" DROP COLUMN "isLater";

-- CreateIndex
CREATE INDEX "Document_enteredReadingAt_idx" ON "Document"("enteredReadingAt");

-- CreateIndex
CREATE INDEX "Document_publishedAtKind_publishedAt_idx" ON "Document"("publishedAtKind", "publishedAt");
