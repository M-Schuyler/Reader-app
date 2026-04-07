import { prisma } from "@/server/db/client";

const HIGHLIGHT_OVERVIEW_PAGE_SIZE = 50;

export type HighlightOverview = {
  totalHighlights: number;
  highlightedDocuments: number;
  highlights: Array<{
    id: string;
    quoteText: string;
    note: string | null;
    createdAt: string;
    document: {
      id: string;
      title: string;
    };
  }>;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

export function normalizeHighlightOverviewPage(value?: string | number) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value !== "string" || value.trim().length === 0) {
    return 1;
  }

  const page = Number.parseInt(value, 10);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

export function buildHighlightOverviewPagination(total: number, requestedPage: number) {
  const totalPages = Math.max(1, Math.ceil(total / HIGHLIGHT_OVERVIEW_PAGE_SIZE));
  const page = Math.min(Math.max(1, requestedPage), totalPages);

  return {
    page,
    pageSize: HIGHLIGHT_OVERVIEW_PAGE_SIZE,
    total,
    totalPages,
    skip: (page - 1) * HIGHLIGHT_OVERVIEW_PAGE_SIZE,
  };
}

export async function getHighlightOverview(pageInput?: string | number): Promise<HighlightOverview> {
  const requestedPage = normalizeHighlightOverviewPage(pageInput);
  const [totalHighlights, highlightedDocuments] = await prisma.$transaction([
    prisma.highlight.count(),
    prisma.document.count({
      where: {
        highlights: {
          some: {},
        },
      },
    }),
  ]);
  const pagination = buildHighlightOverviewPagination(totalHighlights, requestedPage);
  const highlights = await prisma.highlight.findMany({
    orderBy: {
      createdAt: "desc",
    },
    skip: pagination.skip,
    take: pagination.pageSize,
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
  });

  return {
    totalHighlights,
    highlightedDocuments,
    highlights: highlights.map((highlight) => ({
      id: highlight.id,
      quoteText: highlight.quoteText,
      note: highlight.note,
      createdAt: highlight.createdAt.toISOString(),
      document: highlight.document,
    })),
    pagination: {
      page: pagination.page,
      pageSize: pagination.pageSize,
      total: pagination.total,
      totalPages: pagination.totalPages,
    },
  };
}
