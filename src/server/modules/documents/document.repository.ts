import { AiSummaryStatus, DocumentType, IngestionStatus, Prisma, PublishedAtKind, ReadState } from "@prisma/client";
import { prisma } from "@/server/db/client";
import type { DocumentListQuery, DocumentListSort } from "./document.types";

export const documentListArgs = Prisma.validator<Prisma.DocumentDefaultArgs>()({
  include: {
    feed: {
      select: {
        id: true,
        title: true,
      },
    },
    content: {
      select: {
        wordCount: true,
      },
    },
  },
});

export const documentDetailArgs = Prisma.validator<Prisma.DocumentDefaultArgs>()({
  include: {
    feed: {
      select: {
        id: true,
        title: true,
        feedUrl: true,
        siteUrl: true,
      },
    },
    file: {
      select: {
        fileName: true,
        mimeType: true,
        sizeBytes: true,
        pageCount: true,
      },
    },
    content: {
      select: {
        contentHtml: true,
        plainText: true,
        wordCount: true,
        extractedAt: true,
      },
    },
  },
});

export type DocumentListRecord = Prisma.DocumentGetPayload<typeof documentListArgs>;
export type DocumentDetailRecord = Prisma.DocumentGetPayload<typeof documentDetailArgs>;

export async function listDocuments(query: DocumentListQuery) {
  const where = buildDocumentWhere(query);
  const orderBy = buildDocumentOrderBy(query.sort, query.surface);

  const [total, items] = await prisma.$transaction([
    prisma.document.count({ where }),
    prisma.document.findMany({
      ...documentListArgs,
      where,
      orderBy,
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    }),
  ]);

  return { total, items };
}

export async function getDocumentById(id: string) {
  return prisma.document.findUnique({
    where: { id },
    ...documentDetailArgs,
  });
}

export async function markDocumentEnteredReading(id: string) {
  return prisma.document.updateMany({
    where: {
      id,
      enteredReadingAt: null,
    },
    data: {
      enteredReadingAt: new Date(),
    },
  });
}

export async function updateDocumentFavorite(id: string, isFavorite: boolean) {
  return prisma.document.update({
    where: { id },
    data: {
      isFavorite,
    },
    ...documentDetailArgs,
  });
}

export async function findWebDocumentByUrlCandidates(urlCandidates: string[]) {
  if (urlCandidates.length === 0) {
    return null;
  }

  return prisma.document.findFirst({
    where: {
      type: DocumentType.WEB_PAGE,
      OR: [
        {
          sourceUrl: {
            in: urlCandidates,
          },
        },
        {
          canonicalUrl: {
            in: urlCandidates,
          },
        },
      ],
    },
    ...documentDetailArgs,
  });
}

type CreateWebDocumentInput = {
  title: string;
  sourceUrl: string;
  canonicalUrl: string | null;
  lang: string | null;
  excerpt: string;
  author: string | null;
  publishedAt: Date | null;
  publishedAtKind: PublishedAtKind;
  ingestionStatus: IngestionStatus;
  contentHtml: string | null;
  plainText: string;
  rawHtml: string;
  textHash: string;
  wordCount: number;
  extractedAt: Date;
};

export async function createWebDocument(input: CreateWebDocumentInput) {
  return prisma.document.create({
    data: {
      type: DocumentType.WEB_PAGE,
      title: input.title,
      sourceUrl: input.sourceUrl,
      canonicalUrl: input.canonicalUrl,
      lang: input.lang,
      excerpt: input.excerpt,
      author: input.author,
      publishedAt: input.publishedAt,
      publishedAtKind: input.publishedAtKind,
      ingestionStatus: input.ingestionStatus,
      content: {
        create: {
          contentHtml: input.contentHtml,
          plainText: input.plainText,
          rawHtml: input.rawHtml,
          textHash: input.textHash,
          wordCount: input.wordCount,
          extractedAt: input.extractedAt,
        },
      },
    },
    ...documentDetailArgs,
  });
}

type CreateWebDocumentPlaceholderInput = {
  title: string;
  sourceUrl: string;
  canonicalUrl: string | null;
  ingestionStatus: IngestionStatus;
};

export async function createWebDocumentPlaceholder(input: CreateWebDocumentPlaceholderInput) {
  return prisma.document.create({
    data: {
      type: DocumentType.WEB_PAGE,
      title: input.title,
      sourceUrl: input.sourceUrl,
      canonicalUrl: input.canonicalUrl,
      publishedAtKind: PublishedAtKind.UNKNOWN,
      ingestionStatus: input.ingestionStatus,
    },
    ...documentDetailArgs,
  });
}

export async function updateDocumentPublishedAtMetadata(
  id: string,
  input: {
    publishedAt: Date | null;
    publishedAtKind: PublishedAtKind;
  },
) {
  return prisma.document.update({
    where: { id },
    data: {
      publishedAt: input.publishedAt,
      publishedAtKind: input.publishedAtKind,
    },
    ...documentDetailArgs,
  });
}

export async function backfillHostnamePublishedAtUpperBound(input: {
  hostname: string;
  anchorCreatedAt: Date;
  upperBoundPublishedAt: Date;
}) {
  const orClauses = [
    { canonicalUrl: { startsWith: `https://${input.hostname}` } },
    { canonicalUrl: { startsWith: `http://${input.hostname}` } },
    { sourceUrl: { startsWith: `https://${input.hostname}` } },
    { sourceUrl: { startsWith: `http://${input.hostname}` } },
  ];

  return prisma.document.updateMany({
    where: {
      createdAt: {
        lt: input.anchorCreatedAt,
      },
      ingestionStatus: {
        not: IngestionStatus.FAILED,
      },
      publishedAtKind: PublishedAtKind.UNKNOWN,
      publishedAt: null,
      OR: orClauses,
    },
    data: {
      publishedAt: input.upperBoundPublishedAt,
      publishedAtKind: PublishedAtKind.BEFORE,
    },
  });
}

export async function listQuickSearchDocuments(query: string, limit = 6) {
  return prisma.document.findMany({
    ...documentListArgs,
    where: buildDocumentWhere({
      surface: "source",
      q: query,
      page: 1,
      pageSize: limit,
      sort: "latest",
    }),
    orderBy: buildDocumentOrderBy("latest", "source"),
    take: limit,
  });
}

export async function updateDocumentIngestionStatus(id: string, status: IngestionStatus) {
  return prisma.document.update({
    where: { id },
    data: {
      ingestionStatus: status,
    },
  });
}

export async function updateDocumentAiSummary(id: string, aiSummary: string) {
  return prisma.document.update({
    where: { id },
    data: {
      aiSummary,
      aiSummaryStatus: AiSummaryStatus.READY,
      aiSummaryError: null,
    },
    ...documentDetailArgs,
  });
}

export async function updateDocumentAiSummaryState(id: string, status: AiSummaryStatus) {
  return prisma.document.update({
    where: { id },
    data: {
      aiSummaryStatus: status,
      aiSummaryError: null,
    },
    ...documentDetailArgs,
  });
}

export async function updateDocumentAiSummaryFailure(id: string, errorMessage: string, preserveReadyState = false) {
  return prisma.document.update({
    where: { id },
    data: {
      aiSummaryStatus: preserveReadyState ? AiSummaryStatus.READY : AiSummaryStatus.FAILED,
      aiSummaryError: errorMessage,
    },
    ...documentDetailArgs,
  });
}

function buildDocumentWhere(query: DocumentListQuery): Prisma.DocumentWhereInput {
  const clauses: Prisma.DocumentWhereInput[] = [];

  if (query.q) {
    clauses.push({
      OR: [
        {
          title: {
            contains: query.q,
            mode: "insensitive",
          },
        },
        {
          AND: [
            {
              ingestionStatus: {
                not: IngestionStatus.FAILED,
              },
            },
            {
              excerpt: {
                contains: query.q,
                mode: "insensitive",
              },
            },
          ],
        },
        {
          sourceUrl: {
            contains: query.q,
            mode: "insensitive",
          },
        },
        {
          canonicalUrl: {
            contains: query.q,
            mode: "insensitive",
          },
        },
        {
          AND: [
            {
              ingestionStatus: {
                not: IngestionStatus.FAILED,
              },
            },
            {
              content: {
                is: {
                  plainText: {
                    contains: query.q,
                    mode: "insensitive",
                  },
                },
              },
            },
          ],
        },
      ],
    });
  }

  if (query.type) {
    clauses.push({ type: query.type });
  }

  if (query.readState) {
    clauses.push({ readState: query.readState });
  }

  if (typeof query.isFavorite === "boolean") {
    clauses.push({ isFavorite: query.isFavorite });
  }

  if (query.surface === "reading") {
    clauses.push({
      enteredReadingAt: {
        not: null,
      },
    });

    if (!query.readState) {
      clauses.push({
        readState: {
          not: ReadState.READ,
        },
      });
    }
  }

  if (query.tag) {
    clauses.push({
      tags: {
        some: {
          tag: {
            is: {
              OR: [
                {
                  name: {
                    contains: query.tag,
                    mode: "insensitive",
                  },
                },
                {
                  slug: {
                    contains: query.tag,
                    mode: "insensitive",
                  },
                },
              ],
            },
          },
        },
      },
    });
  }

  return clauses.length > 0 ? { AND: clauses } : {};
}

function buildDocumentOrderBy(sort: DocumentListSort, surface: DocumentListQuery["surface"]): Prisma.DocumentOrderByWithRelationInput[] {
  switch (sort) {
    case "earliest":
      return [
        { publishedAt: { sort: "asc", nulls: "last" } },
        surface === "reading" ? { enteredReadingAt: "asc" } : { createdAt: "asc" },
      ];
    case "latest":
    default:
      return [
        { publishedAt: { sort: "desc", nulls: "last" } },
        surface === "reading" ? { enteredReadingAt: "desc" } : { createdAt: "desc" },
      ];
  }
}
