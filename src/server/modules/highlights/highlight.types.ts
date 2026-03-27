import type { Prisma } from "@prisma/client";

export type HighlightRecord = {
  id: string;
  documentId: string;
  quoteText: string;
  note: string | null;
  color: string | null;
  startOffset: number | null;
  endOffset: number | null;
  selectorJson: Prisma.JsonValue | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateHighlightInput = {
  quoteText: string;
  note?: string | null;
  color?: string | null;
  startOffset?: number | null;
  endOffset?: number | null;
  selectorJson?: Prisma.JsonValue | null;
};

export type UpdateHighlightInput = {
  note?: string | null;
  color?: string | null;
};

export type GetDocumentHighlightsResponseData = {
  items: HighlightRecord[];
};

export type HighlightMutationResponseData = {
  highlight: HighlightRecord;
};
