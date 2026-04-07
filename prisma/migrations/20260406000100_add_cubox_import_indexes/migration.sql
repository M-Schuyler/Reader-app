-- Add WEB document external-id lookup support for Cubox imports.
CREATE INDEX "Document_type_externalId_idx" ON "Document"("type", "externalId");

-- Store external highlight ids so Cubox highlight imports can be idempotent.
ALTER TABLE "Highlight" ADD COLUMN "externalId" TEXT;
CREATE UNIQUE INDEX "Highlight_documentId_externalId_key" ON "Highlight"("documentId", "externalId");
