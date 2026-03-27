import { prisma } from "@/server/db/client";

export type HighlightOverview = {
  totalHighlights: number;
  highlightedDocuments: number;
  recentHighlights: Array<{
    id: string;
    quoteText: string;
    note: string | null;
    createdAt: string;
    document: {
      id: string;
      title: string;
    };
  }>;
};

export async function getHighlightOverview(): Promise<HighlightOverview> {
  const [totalHighlights, highlightedDocuments, recentHighlights] = await prisma.$transaction([
    prisma.highlight.count(),
    prisma.document.count({
      where: {
        highlights: {
          some: {},
        },
      },
    }),
    prisma.highlight.findMany({
      orderBy: {
        createdAt: "desc",
      },
      take: 8,
      select: {
        id: true,
        quoteText: true,
        note: true,
        createdAt: true,
        document: {
          select: {
            id: true,
            title: true,
          },
        },
      },
    }),
  ]);

  return {
    totalHighlights,
    highlightedDocuments,
    recentHighlights: recentHighlights.map((highlight) => ({
      id: highlight.id,
      quoteText: highlight.quoteText,
      note: highlight.note,
      createdAt: highlight.createdAt.toISOString(),
      document: highlight.document,
    })),
  };
}
