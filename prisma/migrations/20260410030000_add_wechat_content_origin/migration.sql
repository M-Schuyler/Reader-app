ALTER TABLE "Document"
ADD COLUMN "contentOriginKey" TEXT,
ADD COLUMN "contentOriginLabel" TEXT;

CREATE INDEX "Document_contentOriginKey_idx" ON "Document"("contentOriginKey");
