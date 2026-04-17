-- CreateEnum
CREATE TYPE "TranscriptSource" AS ENUM ('NATIVE', 'GEMINI', 'NONE');

-- CreateEnum
CREATE TYPE "TranscriptStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

-- AlterEnum
ALTER TYPE "IngestionJobKind" ADD VALUE 'GENERATE_TRANSCRIPT';

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "transcriptSource" "TranscriptSource",
ADD COLUMN     "transcriptStatus" "TranscriptStatus";
