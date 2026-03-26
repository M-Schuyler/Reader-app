-- CreateEnum
CREATE TYPE "AiSummaryStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

-- AlterTable
ALTER TABLE "Document"
ADD COLUMN     "aiSummaryStatus" "AiSummaryStatus",
ADD COLUMN     "aiSummaryError" TEXT;

-- Backfill rows that already have a generated summary.
UPDATE "Document"
SET "aiSummaryStatus" = 'READY',
    "aiSummaryError" = NULL
WHERE "aiSummary" IS NOT NULL;

-- Backfill rows that can never generate a summary because ingestion failed.
UPDATE "Document"
SET "aiSummaryStatus" = 'FAILED',
    "aiSummaryError" = '正文抓取失败，当前文档暂时无法生成 AI 摘要。'
WHERE "isFavorite" = TRUE
  AND "aiSummary" IS NULL
  AND "ingestionStatus" = 'FAILED';
