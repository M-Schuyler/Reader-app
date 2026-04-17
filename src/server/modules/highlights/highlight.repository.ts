import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/client";

export async function listHighlightsByDocumentId(documentId: string) {
  return prisma.highlight.findMany({
    where: { documentId },
    orderBy: { createdAt: "asc" },
  });
}

export async function listExportHighlightsByDocumentIds(documentIds: string[]) {
  if (documentIds.length === 0) {
    return [];
  }

  return prisma.highlight.findMany({
    where: {
      documentId: {
        in: documentIds,
      },
    },
    orderBy: [
      { documentId: "asc" },
      { createdAt: "asc" },
    ],
    select: {
      documentId: true,
      quoteText: true,
      note: true,
      color: true,
      createdAt: true,
    },
  });
}

export async function createHighlight(data: Prisma.HighlightUncheckedCreateInput) {
  return prisma.highlight.create({ data });
}

export async function getHighlightableDocumentById(documentId: string) {
  return prisma.document.findUnique({
    where: {
      id: documentId,
    },
    select: {
      id: true,
      ingestionStatus: true,
      content: {
        select: {
          id: true,
        },
      },
    },
  });
}

export async function updateHighlight(id: string, data: Prisma.HighlightUpdateInput) {
  return prisma.highlight.update({
    where: { id },
    data,
  });
}

export async function deleteHighlight(id: string) {
  return prisma.highlight.delete({
    where: { id },
  });
}

export async function getHighlightById(id: string) {
  return prisma.highlight.findUnique({
    where: { id },
  });
}
