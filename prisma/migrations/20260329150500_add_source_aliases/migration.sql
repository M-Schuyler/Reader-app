CREATE TYPE "SourceAliasKind" AS ENUM ('FEED', 'DOMAIN');

CREATE TABLE "SourceAlias" (
    "id" TEXT NOT NULL,
    "kind" "SourceAliasKind" NOT NULL,
    "value" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SourceAlias_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SourceAlias_kind_value_key" ON "SourceAlias"("kind", "value");
CREATE INDEX "SourceAlias_kind_name_idx" ON "SourceAlias"("kind", "name");
