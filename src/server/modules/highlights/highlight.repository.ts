import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/client";

export async function listHighlightsByDocumentId(documentId: string) {
  return prisma.highlight.findMany({
    where: { documentId },
    orderBy: { createdAt: "asc" },
  });
}

export async function createHighlight(data: Prisma.HighlightUncheckedCreateInput) {
  return prisma.highlight.create({ data });
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
