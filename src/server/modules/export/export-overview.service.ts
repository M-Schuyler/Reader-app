import { IngestionStatus } from "@prisma/client";
import { prisma } from "@/server/db/client";

export type ExportOverview = {
  starredDocuments: number;
  summarizedDocuments: number;
  highlightedDocuments: number;
  candidates: Array<{
    id: string;
    title: string;
    sourceUrl: string | null;
    canonicalUrl: string | null;
    updatedAt: string;
    isFavorite: boolean;
    hasSummary: boolean;
    highlightCount: number;
  }>;
};

export async function getExportOverview(): Promise<ExportOverview> {
  const [starredDocuments, summarizedDocuments, highlightedDocuments, candidates] = await prisma.$transaction([
    prisma.document.count({
      where: {
        isFavorite: true,
      },
    }),
    prisma.document.count({
      where: {
        aiSummary: {
          not: null,
        },
      },
    }),
    prisma.document.count({
      where: {
        highlights: {
          some: {},
        },
      },
    }),
    prisma.document.findMany({
      where: {
        ingestionStatus: IngestionStatus.READY,
        OR: [
          {
            isFavorite: true,
          },
          {
            aiSummary: {
              not: null,
            },
          },
          {
            highlights: {
              some: {},
            },
          },
        ],
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 8,
      select: {
        id: true,
        title: true,
        sourceUrl: true,
        canonicalUrl: true,
        updatedAt: true,
        isFavorite: true,
        aiSummary: true,
        _count: {
          select: {
            highlights: true,
          },
        },
      },
    }),
  ]);

  return {
    starredDocuments,
    summarizedDocuments,
    highlightedDocuments,
    candidates: candidates.map((document) => ({
      id: document.id,
      title: document.title,
      sourceUrl: document.sourceUrl,
      canonicalUrl: document.canonicalUrl,
      updatedAt: document.updatedAt.toISOString(),
      isFavorite: document.isFavorite,
      hasSummary: Boolean(document.aiSummary),
      highlightCount: document._count.highlights,
    })),
  };
}
