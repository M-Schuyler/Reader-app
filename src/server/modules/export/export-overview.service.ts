import { IngestionStatus } from "@prisma/client";
import { prisma } from "@/server/db/client";

const EXPORT_CANDIDATE_LIMIT = 50;

export type ExportOverview = {
  starredDocuments: number;
  summarizedDocuments: number;
  highlightedDocuments: number;
  candidates: Array<{
    id: string;
    title: string;
    author: string | null;
    sourceUrl: string | null;
    canonicalUrl: string | null;
    publishedAt: string | null;
    publishedAtKind: any;
    createdAt: string;
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
      take: EXPORT_CANDIDATE_LIMIT,
      select: {
        id: true,
        title: true,
        author: true,
        sourceUrl: true,
        canonicalUrl: true,
        publishedAt: true,
        publishedAtKind: true,
        createdAt: true,
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
      author: document.author,
      sourceUrl: document.sourceUrl,
      canonicalUrl: document.canonicalUrl,
      publishedAt: document.publishedAt?.toISOString() ?? null,
      publishedAtKind: document.publishedAtKind,
      createdAt: document.createdAt.toISOString(),
      updatedAt: document.updatedAt.toISOString(),
      isFavorite: document.isFavorite,
      hasSummary: Boolean(document.aiSummary),
      highlightCount: document._count.highlights,
    })),
  };
}
