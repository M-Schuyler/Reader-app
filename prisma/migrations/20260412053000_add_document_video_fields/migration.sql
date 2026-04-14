-- AlterTable
ALTER TABLE "Document"
ADD COLUMN "videoUrl" TEXT,
ADD COLUMN "videoProvider" TEXT,
ADD COLUMN "videoThumbnailUrl" TEXT,
ADD COLUMN "videoDurationSeconds" INTEGER,
ADD COLUMN "transcriptSegments" JSONB;

-- CreateIndex
CREATE INDEX "Document_videoUrl_idx" ON "Document"("videoUrl");

-- CreateIndex
CREATE INDEX "Document_videoProvider_idx" ON "Document"("videoProvider");
