import { DocumentType, IngestionStatus } from "@prisma/client";
import { RouteError } from "@/server/api/response";
import { getDocument } from "@/server/modules/documents/document.service";
import { prisma } from "@/server/db/client";
import {
  isQaRealDocumentId,
  mapQaRealDocument,
  mapQaRealHighlight,
  parseQaRealDocumentId,
  parseQaRealHighlightId,
} from "@/lib/highlights/qa-real-document";
import type { DocumentDetail } from "@/server/modules/documents/document.types";
import type {
  CreateHighlightInput,
  GetDocumentHighlightsResponseData,
  HighlightMutationResponseData,
  UpdateHighlightInput,
} from "./highlight.types";
import { assertQaFixtureEnabled } from "./highlight-qa-store";
import { addDocumentHighlight, editHighlight, getDocumentHighlights, removeHighlight } from "./highlight.service";

export async function getQaRealReaderDocument(requestedId?: string): Promise<{
  actualId: string;
  document: DocumentDetail;
} | null> {
  assertQaFixtureEnabled();

  const actualId = await resolveQaRealDocumentId(requestedId);

  if (!actualId) {
    return null;
  }

  const data = await getDocument(actualId);

  if (!data) {
    return null;
  }

  return {
    actualId,
    document: mapQaRealDocument(data.document),
  };
}

export async function getQaRealDocumentHighlights(documentId: string): Promise<GetDocumentHighlightsResponseData> {
  assertQaFixtureEnabled();

  const actualId = parseRealDocumentAlias(documentId);
  const data = await getDocumentHighlights(actualId);

  return {
    items: data.items.map(mapQaRealHighlight),
  };
}

export async function addQaRealDocumentHighlight(
  documentId: string,
  input: CreateHighlightInput,
): Promise<HighlightMutationResponseData | null> {
  assertQaFixtureEnabled();

  const actualId = parseRealDocumentAlias(documentId);
  const data = await addDocumentHighlight(actualId, input);

  if (!data) {
    return null;
  }

  return {
    highlight: mapQaRealHighlight(data.highlight),
  };
}

export async function editQaRealHighlight(
  highlightId: string,
  input: UpdateHighlightInput,
): Promise<HighlightMutationResponseData | null> {
  assertQaFixtureEnabled();

  const actualId = parseQaRealHighlightId(highlightId);
  const data = await editHighlight(actualId, input);

  if (!data) {
    return null;
  }

  return {
    highlight: mapQaRealHighlight(data.highlight),
  };
}

export async function removeQaRealHighlight(highlightId: string) {
  assertQaFixtureEnabled();

  const actualId = parseQaRealHighlightId(highlightId);
  const data = await removeHighlight(actualId);

  if (!data) {
    return null;
  }

  return {
    id: highlightId,
  };
}

async function resolveQaRealDocumentId(requestedId?: string) {
  if (requestedId) {
    return isQaRealDocumentId(requestedId) ? parseQaRealDocumentId(requestedId) : requestedId;
  }

  const withoutHighlights = await prisma.document.findFirst({
    where: {
      type: DocumentType.WEB_PAGE,
      ingestionStatus: IngestionStatus.READY,
      content: {
        is: {
          plainText: {
            not: "",
          },
        },
      },
      highlights: {
        none: {},
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
    },
  });

  if (withoutHighlights?.id) {
    return withoutHighlights.id;
  }

  const fallback = await prisma.document.findFirst({
    where: {
      type: DocumentType.WEB_PAGE,
      ingestionStatus: IngestionStatus.READY,
      content: {
        is: {
          plainText: {
            not: "",
          },
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
    },
  });

  return fallback?.id ?? null;
}

function parseRealDocumentAlias(documentId: string) {
  if (!isQaRealDocumentId(documentId)) {
    throw new RouteError("NOT_FOUND", 404, "Not found.");
  }

  return parseQaRealDocumentId(documentId);
}
