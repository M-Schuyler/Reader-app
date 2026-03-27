import fs from "node:fs/promises";
import path from "node:path";
import { RouteError } from "@/server/api/response";
import { QA_HIGHLIGHTS_DOCUMENT_ID } from "@/lib/highlights/fixture-document";
import type {
  CreateHighlightInput,
  GetDocumentHighlightsResponseData,
  HighlightMutationResponseData,
  HighlightRecord,
  UpdateHighlightInput,
} from "./highlight.types";

const QA_HIGHLIGHT_ID_PREFIX = "qa-highlight-";

export function isQaHighlightId(id: string) {
  return id.startsWith(QA_HIGHLIGHT_ID_PREFIX);
}

export async function getQaDocumentHighlights(): Promise<GetDocumentHighlightsResponseData> {
  return {
    items: await readStore(),
  };
}

export async function addQaDocumentHighlight(input: CreateHighlightInput): Promise<HighlightMutationResponseData> {
  const highlights = await readStore();
  const now = new Date().toISOString();

  const highlight: HighlightRecord = {
    id: `${QA_HIGHLIGHT_ID_PREFIX}${globalThis.crypto?.randomUUID?.() ?? Date.now().toString(36)}`,
    documentId: QA_HIGHLIGHTS_DOCUMENT_ID,
    quoteText: input.quoteText,
    note: input.note ?? null,
    color: input.color ?? null,
    startOffset: input.startOffset ?? null,
    endOffset: input.endOffset ?? null,
    selectorJson: input.selectorJson ?? null,
    createdAt: now,
    updatedAt: now,
  };

  highlights.push(highlight);
  await writeStore(sortHighlights(highlights));

  return { highlight };
}

export async function editQaHighlight(id: string, input: UpdateHighlightInput): Promise<HighlightMutationResponseData | null> {
  const highlights = await readStore();
  const index = highlights.findIndex((highlight) => highlight.id === id);

  if (index === -1) {
    return null;
  }

  const updatedHighlight: HighlightRecord = {
    ...highlights[index],
    ...(typeof input.note !== "undefined" ? { note: input.note ?? null } : {}),
    ...(typeof input.color !== "undefined" ? { color: input.color ?? null } : {}),
    updatedAt: new Date().toISOString(),
  };

  highlights[index] = updatedHighlight;
  await writeStore(sortHighlights(highlights));

  return {
    highlight: updatedHighlight,
  };
}

export async function removeQaHighlight(id: string) {
  const highlights = await readStore();
  const nextHighlights = highlights.filter((highlight) => highlight.id !== id);

  if (nextHighlights.length === highlights.length) {
    return null;
  }

  await writeStore(nextHighlights);
  return { id };
}

export async function resetQaHighlights() {
  await writeStore([]);
}

export function assertQaFixtureEnabled() {
  if (process.env.NODE_ENV === "production") {
    throw new RouteError("NOT_FOUND", 404, "Not found.");
  }
}

async function readStore() {
  assertQaFixtureEnabled();

  try {
    const raw = await fs.readFile(storeFilePath(), "utf8");
    const items = JSON.parse(raw) as HighlightRecord[];
    return sortHighlights(Array.isArray(items) ? items : []);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  }
}

async function writeStore(highlights: HighlightRecord[]) {
  assertQaFixtureEnabled();

  await fs.mkdir(path.dirname(storeFilePath()), { recursive: true });
  await fs.writeFile(storeFilePath(), JSON.stringify(highlights, null, 2), "utf8");
}

function storeFilePath() {
  return path.join(process.cwd(), ".qa-artifacts", "highlights-document-store.json");
}

function sortHighlights(highlights: HighlightRecord[]) {
  return [...highlights].sort((left, right) => {
    const leftStart = left.startOffset ?? Number.MAX_SAFE_INTEGER;
    const rightStart = right.startOffset ?? Number.MAX_SAFE_INTEGER;

    if (leftStart !== rightStart) {
      return leftStart - rightStart;
    }

    return left.quoteText.localeCompare(right.quoteText);
  });
}
