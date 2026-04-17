import {
  AiSummaryStatus,
  DocumentType,
  IngestionJobKind,
  IngestionJobStatus,
  IngestionStatus,
  Prisma,
  PublishedAtKind,
  ReadState,
  SourceAliasKind,
  TranscriptSource,
  TranscriptStatus,
} from "@prisma/client";
import { prisma } from "@/server/db/client";
import type {
  CaptureIngestionError,
  DocumentListQuery,
  DocumentListSort,
  SourceAliasTargetKind,
  SourceLibraryIndexRow,
} from "./document.types";

export const documentListArgs = Prisma.validator<Prisma.DocumentDefaultArgs>()({
  include: {
    source: {
      select: {
        id: true,
        title: true,
        kind: true,
        siteUrl: true,
        locatorUrl: true,
        includeCategories: true,
        lastSyncedAt: true,
        lastSyncStatus: true,
      },
    },
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
    tags: {
      select: {
        tag: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    },
  },
});

export const documentOriginRowArgs = Prisma.validator<Prisma.DocumentDefaultArgs>()({
  select: {
    id: true,
    author: true,
    sourceUrl: true,
    canonicalUrl: true,
    contentOriginKey: true,
    contentOriginLabel: true,
    content: {
      select: {
        rawHtml: true,
      },
    },
  },
});

export const documentDetailArgs = Prisma.validator<Prisma.DocumentDefaultArgs>()({
  include: {
    source: {
      select: {
        id: true,
        title: true,
        kind: true,
        siteUrl: true,
        locatorUrl: true,
        includeCategories: true,
        lastSyncedAt: true,
        lastSyncStatus: true,
      },
    },
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
        rawHtml: true,
        textHash: true,
        wordCount: true,
        extractedAt: true,
      },
    },
    tags: {
      select: {
        tag: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
      },
    },
  },
});

export const sourceIndexRowArgs = Prisma.validator<Prisma.DocumentDefaultArgs>()({
  select: {
    createdAt: true,
    sourceUrl: true,
    canonicalUrl: true,
    source: {
      select: {
        id: true,
        title: true,
        includeCategories: true,
      },
    },
    feed: {
      select: {
        id: true,
        title: true,
      },
    },
  },
});

export type DocumentListRecord = Prisma.DocumentGetPayload<typeof documentListArgs>;
export type DocumentDetailRecord = Prisma.DocumentGetPayload<typeof documentDetailArgs>;
export type SourceIndexRowRecord = Prisma.DocumentGetPayload<typeof sourceIndexRowArgs>;
export type DocumentOriginRowRecord = Prisma.DocumentGetPayload<typeof documentOriginRowArgs>;

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

export async function listDocumentsByIds(ids: string[]) {
  if (ids.length === 0) {
    return [];
  }

  return prisma.document.findMany({
    ...documentListArgs,
    where: {
      id: {
        in: ids,
      },
    },
  });
}

export async function listDocumentOriginRows(query: DocumentListQuery) {
  return prisma.document.findMany({
    ...documentOriginRowArgs,
    where: buildDocumentWhere({
      ...query,
      origin: undefined,
    }),
    orderBy: buildDocumentOrderBy(query.sort, query.surface),
  });
}

export async function listSourceIndexRows(query: DocumentListQuery): Promise<{
  total: number;
  rows: SourceLibraryIndexRow[];
}> {
  const where = buildDocumentWhere(query);

  const [total, rows] = await prisma.$transaction([
    prisma.document.count({ where }),
    prisma.document.findMany({
      ...sourceIndexRowArgs,
      where,
    }),
  ]);

  return {
    total,
    rows: rows.map((row) => ({
      createdAt: row.createdAt.toISOString(),
      sourceUrl: row.sourceUrl,
      canonicalUrl: row.canonicalUrl,
      source: row.source
        ? {
            id: row.source.id,
            title: row.source.title,
            includeCategories: row.source.includeCategories,
          }
        : null,
      feed: row.feed
        ? {
            id: row.feed.id,
            title: row.feed.title,
          }
        : null,
    })),
  };
}

export async function getDocumentById(id: string) {
  return prisma.document.findUnique({
    where: { id },
    ...documentDetailArgs,
  });
}

export const documentReaderArgs = Prisma.validator<Prisma.DocumentDefaultArgs>()({
  select: {
    id: true,
    title: true,
    type: true,
    readState: true,
    readingProgress: true,
    isFavorite: true,
    ingestionStatus: true,
    author: true,
    publishedAt: true,
    publishedAtKind: true,
    enteredReadingAt: true,
    sourceUrl: true,
    canonicalUrl: true,
    contentOriginLabel: true,
    videoUrl: true,
    videoProvider: true,
    videoDurationSeconds: true,
    transcriptSegments: true,
    transcriptSource: true,
    transcriptStatus: true,
    aiSummary: true,
    aiSummaryStatus: true,
    aiSummaryError: true,
    excerpt: true,
    content: {
      select: {
        contentHtml: true,
        wordCount: true,
      },
    },
  },
});

export type DocumentReaderRecord = Prisma.DocumentGetPayload<typeof documentReaderArgs>;

export async function getReaderDocumentById(id: string) {
  return prisma.document.findUnique({
    where: { id },
    ...documentReaderArgs,
  });
}

export async function getReaderNextDocument(currentId: string, query: DocumentListQuery) {
  const where = buildDocumentWhere(query);
  const orderBy = buildDocumentOrderBy(query.sort, query.surface);

  return prisma.document.findFirst({
    where,
    orderBy,
    cursor: { id: currentId },
    skip: 1,
    ...documentListArgs,
  });
}

export async function findLatestCaptureErrorForDocument(document: Pick<DocumentDetailRecord, "id" | "sourceUrl" | "ingestionStatus">) {
  if (document.ingestionStatus !== IngestionStatus.FAILED) {
    return null;
  }

  const orClauses: Array<{ documentId?: string; sourceUrl?: string }> = [{ documentId: document.id }];
  if (document.sourceUrl) {
    orClauses.push({ sourceUrl: document.sourceUrl });
  }

  const failedJob = await prisma.ingestionJob.findFirst({
    where: {
      kind: IngestionJobKind.FETCH_WEB_PAGE,
      status: IngestionJobStatus.FAILED,
      OR: orClauses,
    },
    orderBy: [{ finishedAt: "desc" }, { createdAt: "desc" }],
    select: {
      payloadJson: true,
      errorMessage: true,
    },
  });

  const payloadError = extractCaptureErrorFromPayload(failedJob?.payloadJson);
  if (payloadError) {
    return payloadError;
  }

  if (failedJob?.errorMessage) {
    return {
      code: "CAPTURE_FAILED",
      message: failedJob.errorMessage,
    };
  }

  return null;
}

export async function deleteDocumentById(id: string) {
  return prisma.document.delete({
    where: { id },
    select: {
      id: true,
    },
  });
}

function extractCaptureErrorFromPayload(payload: unknown): CaptureIngestionError | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const error = (payload as { error?: unknown }).error;
  if (!error || typeof error !== "object" || Array.isArray(error)) {
    return null;
  }

  const code = typeof (error as { code?: unknown }).code === "string" ? (error as { code: string }).code : null;
  const message =
    typeof (error as { message?: unknown }).message === "string" ? (error as { message: string }).message : null;

  if (!code || !message) {
    return null;
  }

  return {
    code,
    message,
  };
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

export async function markDocumentRead(id: string) {
  return prisma.document.update({
    where: { id },
    data: {
      readState: ReadState.READ,
      readingProgress: 100,
    },
    ...documentDetailArgs,
  });
}

export async function updateDocumentReadingProgress(id: string, progress: number) {
  return prisma.document.update({
    where: { id },
    data: {
      readingProgress: progress,
      ...(progress > 0 && progress < 100
        ? {
            readState: {
              set: ReadState.READING,
            },
          }
        : {}),
    },
    ...documentDetailArgs,
  });
}

export async function listSourceAliases(inputs: Array<{ kind: SourceAliasTargetKind; value: string }>) {
  if (inputs.length === 0) {
    return [];
  }

  return prisma.sourceAlias.findMany({
    where: {
      OR: inputs.map((input) => ({
        kind: toSourceAliasKind(input.kind),
        value: input.value,
      })),
    },
  });
}

export async function upsertSourceAlias(input: { kind: SourceAliasTargetKind; value: string; name: string }) {
  return prisma.sourceAlias.upsert({
    where: {
      kind_value: {
        kind: toSourceAliasKind(input.kind),
        value: input.value,
      },
    },
    create: {
      kind: toSourceAliasKind(input.kind),
      value: input.value,
      name: input.name,
    },
    update: {
      name: input.name,
    },
  });
}

export async function deleteSourceAlias(input: { kind: SourceAliasTargetKind; value: string }) {
  return prisma.sourceAlias.deleteMany({
    where: {
      kind: toSourceAliasKind(input.kind),
      value: input.value,
    },
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

export async function findWebDocumentByExternalId(externalId: string) {
  return prisma.document.findFirst({
    where: {
      type: DocumentType.WEB_PAGE,
      externalId,
    },
    ...documentDetailArgs,
  });
}

type CreateWebDocumentInput = {
  title: string;
  sourceUrl: string;
  canonicalUrl: string | null;
  externalId?: string | null;
  sourceId?: string | null;
  lang: string | null;
  excerpt: string;
  author: string | null;
  contentOriginKey: string | null;
  contentOriginLabel: string | null;
  videoUrl?: string | null;
  videoProvider?: string | null;
  videoThumbnailUrl?: string | null;
  videoDurationSeconds?: number | null;
  transcriptSegments?: Prisma.InputJsonValue;
  transcriptSource?: TranscriptSource | null;
  transcriptStatus?: TranscriptStatus | null;
  publishedAt: Date | null;
  publishedAtKind: PublishedAtKind;
  ingestionStatus: IngestionStatus;
  contentHtml: string | null;
  plainText: string;
  rawHtml: string | null;
  textHash: string;
  wordCount: number | null;
  extractedAt: Date;
  dedupeKey: string | null;
};

type CreateRssDocumentInput = {
  sourceId: string;
  feedId: string;
  title: string;
  sourceUrl: string | null;
  canonicalUrl: string | null;
  externalId: string;
  lang: string | null;
  excerpt: string;
  author: string | null;
  publishedAt: Date | null;
  publishedAtKind: PublishedAtKind;
  ingestionStatus: IngestionStatus;
  contentHtml: string | null;
  plainText: string;
  rawHtml: string | null;
  textHash: string;
  wordCount: number;
  extractedAt: Date;
  dedupeKey: string | null;
};

export async function createWebDocument(input: CreateWebDocumentInput) {
  return prisma.document.create({
    data: {
      type: DocumentType.WEB_PAGE,
      title: input.title,
      sourceUrl: input.sourceUrl,
      canonicalUrl: input.canonicalUrl,
      dedupeKey: input.dedupeKey,
      externalId: input.externalId ?? null,
      sourceId: input.sourceId ?? null,
      lang: input.lang,
      excerpt: input.excerpt,
      author: input.author,
      contentOriginKey: input.contentOriginKey,
      contentOriginLabel: input.contentOriginLabel,
      videoUrl: input.videoUrl ?? null,
      videoProvider: input.videoProvider ?? null,
      videoThumbnailUrl: input.videoThumbnailUrl ?? null,
      videoDurationSeconds: input.videoDurationSeconds ?? null,
      ...(typeof input.transcriptSegments === "undefined"
        ? {}
        : {
            transcriptSegments: input.transcriptSegments,
            transcriptSource: input.transcriptSource,
            transcriptStatus: input.transcriptStatus,
          }),
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

export async function findDocumentByDedupeKey(dedupeKey: string) {
  return prisma.document.findUnique({
    where: { dedupeKey },
    ...documentDetailArgs,
  });
}

export async function findDocumentByContentHash(textHash: string) {
  return prisma.document.findFirst({
    where: {
      content: {
        textHash,
      },
    },
    ...documentDetailArgs,
  });
}

type RefreshVideoWebDocumentInput = {
  title: string;
  sourceUrl: string;
  canonicalUrl: string;
  externalId: string;
  lang: string | null;
  excerpt: string;
  author: string | null;
  videoUrl: string;
  videoProvider: string;
  videoThumbnailUrl: string | null;
  videoDurationSeconds: number | null;
  transcriptSegments: Prisma.InputJsonValue;
  transcriptSource: TranscriptSource;
  transcriptStatus: TranscriptStatus;
  publishedAt: Date | null;
  publishedAtKind: PublishedAtKind;
  ingestionStatus: IngestionStatus;
  plainText: string;
  textHash: string;
  wordCount: number;
  extractedAt: Date;
};

export async function refreshVideoWebDocument(id: string, input: RefreshVideoWebDocumentInput) {
  return prisma.document.update({
    where: { id },
    data: {
      title: input.title,
      sourceUrl: input.sourceUrl,
      canonicalUrl: input.canonicalUrl,
      externalId: input.externalId,
      lang: input.lang,
      excerpt: input.excerpt,
      author: input.author,
      contentOriginKey: null,
      contentOriginLabel: null,
      videoUrl: input.videoUrl,
      videoProvider: input.videoProvider,
      videoThumbnailUrl: input.videoThumbnailUrl,
      videoDurationSeconds: input.videoDurationSeconds,
      transcriptSegments: input.transcriptSegments,
      transcriptSource: input.transcriptSource,
      transcriptStatus: input.transcriptStatus,
      publishedAt: input.publishedAt,
      publishedAtKind: input.publishedAtKind,
      ingestionStatus: input.ingestionStatus,
      content: {
        upsert: {
          create: {
            contentHtml: null,
            plainText: input.plainText,
            rawHtml: null,
            textHash: input.textHash,
            wordCount: input.wordCount,
            extractedAt: input.extractedAt,
          },
          update: {
            contentHtml: null,
            plainText: input.plainText,
            rawHtml: null,
            textHash: input.textHash,
            wordCount: input.wordCount,
            extractedAt: input.extractedAt,
          },
        },
      },
    },
    ...documentDetailArgs,
  });
}

export async function findRssDocumentByExternalId(feedId: string, externalId: string) {
  return prisma.document.findUnique({
    where: {
      feedId_externalId: {
        feedId,
        externalId,
      },
    },
    ...documentDetailArgs,
  });
}

export async function findRssDocumentByUrlCandidates(feedId: string, urlCandidates: string[]) {
  if (urlCandidates.length === 0) {
    return null;
  }

  return prisma.document.findFirst({
    where: {
      type: DocumentType.RSS_ITEM,
      feedId,
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

export async function findRssDocumentByTitleAndTextHash(feedId: string, title: string, textHash: string) {
  return prisma.document.findFirst({
    where: {
      type: DocumentType.RSS_ITEM,
      feedId,
      title,
      content: {
        is: {
          textHash,
        },
      },
    },
    ...documentDetailArgs,
  });
}

export async function createRssDocument(input: CreateRssDocumentInput) {
  return prisma.document.create({
    data: {
      type: DocumentType.RSS_ITEM,
      title: input.title,
      sourceId: input.sourceId,
      feedId: input.feedId,
      sourceUrl: input.sourceUrl,
      canonicalUrl: input.canonicalUrl,
      dedupeKey: input.dedupeKey,
      externalId: input.externalId,
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
  sourceId?: string | null;
  ingestionStatus: IngestionStatus;
  dedupeKey: string | null;
};

export async function createWebDocumentPlaceholder(input: CreateWebDocumentPlaceholderInput) {
  return prisma.document.create({
    data: {
      type: DocumentType.WEB_PAGE,
      title: input.title,
      sourceUrl: input.sourceUrl,
      canonicalUrl: input.canonicalUrl,
      sourceId: input.sourceId ?? null,
      dedupeKey: input.dedupeKey,
      publishedAtKind: PublishedAtKind.UNKNOWN,
      ingestionStatus: input.ingestionStatus,
    },
    ...documentDetailArgs,
  });
}

export async function listWechatContentOriginBackfillCandidates(limit: number) {
  const scanLimit = limit * 10;
  const candidates = await prisma.document.findMany({
    where: buildWechatContentOriginBackfillWhere(),
    orderBy: {
      createdAt: "asc",
    },
    take: scanLimit + 1,
    select: {
      id: true,
      author: true,
      sourceUrl: true,
      canonicalUrl: true,
      contentOriginKey: true,
      contentOriginLabel: true,
    },
  });
  const repairableCandidates = candidates.filter(isRepairableWechatContentOriginCandidate);

  return {
    hasMore: repairableCandidates.length > limit || candidates.length > scanLimit,
    items: repairableCandidates.slice(0, limit),
  };
}

export async function updateDocumentContentOrigin(
  id: string,
  input: {
    contentOriginKey: string;
    contentOriginLabel: string;
    author?: string | null;
  },
) {
  return prisma.document.update({
    where: { id },
    data: {
      contentOriginKey: input.contentOriginKey,
      contentOriginLabel: input.contentOriginLabel,
      ...(typeof input.author === "undefined" ? {} : { author: input.author }),
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

  if (query.sourceId) {
    clauses.push({ sourceId: query.sourceId });
  }

  if (query.source) {
    clauses.push(buildDocumentSourceWhere(query.source));
  }

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
              slug: {
                equals: query.tag,
                mode: "insensitive",
              },
            },
          },
        },
      },
    });
  }

  return clauses.length > 0 ? { AND: clauses } : {};
}

function toSourceAliasKind(kind: SourceAliasTargetKind) {
  switch (kind) {
    case "feed":
      return SourceAliasKind.FEED;
    case "domain":
      return SourceAliasKind.DOMAIN;
  }
}

function buildDocumentSourceWhere(source: NonNullable<DocumentListQuery["source"]>): Prisma.DocumentWhereInput {
  switch (source.kind) {
    case "feed":
      return {
        feed: {
          is: {
            id: source.value,
          },
        },
      };
    case "domain":
      return {
        OR: [
          {
            canonicalUrl: {
              startsWith: `https://${source.value}`,
            },
          },
          {
            canonicalUrl: {
              startsWith: `http://${source.value}`,
            },
          },
          {
            sourceUrl: {
              startsWith: `https://${source.value}`,
            },
          },
          {
            sourceUrl: {
              startsWith: `http://${source.value}`,
            },
          },
        ],
      };
    case "unknown":
      return {
        sourceId: null,
        feedId: null,
        sourceUrl: null,
        canonicalUrl: null,
      };
    default:
      return {};
  }
}

function buildDocumentOrderBy(sort: DocumentListSort, surface: DocumentListQuery["surface"]): Prisma.DocumentOrderByWithRelationInput[] {
  let base: Prisma.DocumentOrderByWithRelationInput[];

  if (surface === "source") {
    base = sort === "earliest" ? [{ createdAt: "asc" }] : [{ createdAt: "desc" }];
  } else {
    switch (sort) {
      case "earliest":
        base = [
          { publishedAt: { sort: "asc", nulls: "last" } },
          surface === "reading" ? { enteredReadingAt: "asc" } : { createdAt: "asc" },
        ];
        break;
      case "latest":
      default:
        base = [
          { publishedAt: { sort: "desc", nulls: "last" } },
          surface === "reading" ? { enteredReadingAt: "desc" } : { createdAt: "desc" },
        ];
        break;
    }
  }

  return [...base, { id: sort === "earliest" ? "asc" : "desc" }];
}

export const __documentRepositoryForTests = {
  buildDocumentSourceWhere,
  buildWechatContentOriginBackfillWhere,
  isRepairableWechatContentOriginCandidate,
};

function buildWechatContentOriginBackfillWhere(): Prisma.DocumentWhereInput {
  const mpWeixinUrlWhere = {
    OR: [
      { canonicalUrl: { startsWith: "https://mp.weixin.qq.com" } },
      { canonicalUrl: { startsWith: "http://mp.weixin.qq.com" } },
      { sourceUrl: { startsWith: "https://mp.weixin.qq.com" } },
      { sourceUrl: { startsWith: "http://mp.weixin.qq.com" } },
    ],
  };

  return {
    type: DocumentType.WEB_PAGE,
    AND: [
      {
        OR: [
          {
            AND: [
              { contentOriginKey: null },
              mpWeixinUrlWhere,
            ],
          },
          {
            AND: [
              {
                contentOriginKey: {
                  not: "wechat:unknown",
                },
              },
              {
                contentOriginLabel: "未识别公众号",
              },
              mpWeixinUrlWhere,
            ],
          },
        ],
      },
    ],
  };
}

function isRepairableWechatContentOriginCandidate(candidate: {
  author: string | null;
  contentOriginKey: string | null;
  contentOriginLabel: string | null;
  canonicalUrl: string | null;
  sourceUrl: string | null;
}) {
  if (candidate.contentOriginKey === null) {
    return true;
  }

  if (candidate.contentOriginKey !== "wechat:unknown" && candidate.contentOriginLabel === "未识别公众号") {
    return true;
  }

  return false;
}

function hasWechatBizInCandidateUrls(candidate: {
  canonicalUrl: string | null;
  sourceUrl: string | null;
}) {
  return hasWechatBizInUrl(candidate.canonicalUrl) || hasWechatBizInUrl(candidate.sourceUrl);
}

function hasWechatBizInUrl(value: string | null) {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);
    return url.hostname === "mp.weixin.qq.com" && url.searchParams.has("__biz");
  } catch {
    return false;
  }
}
