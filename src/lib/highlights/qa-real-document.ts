import type { DocumentDetail } from "@/server/modules/documents/document.types";
import type { HighlightRecord } from "@/server/modules/highlights/highlight.types";

const QA_REAL_DOCUMENT_ID_PREFIX = "qa-real-document--";
const QA_REAL_HIGHLIGHT_ID_PREFIX = "qa-real-highlight--";

export function toQaRealDocumentId(actualDocumentId: string) {
  return `${QA_REAL_DOCUMENT_ID_PREFIX}${actualDocumentId}`;
}

export function isQaRealDocumentId(id: string) {
  return id.startsWith(QA_REAL_DOCUMENT_ID_PREFIX);
}

export function parseQaRealDocumentId(id: string) {
  return id.slice(QA_REAL_DOCUMENT_ID_PREFIX.length);
}

export function toQaRealHighlightId(actualHighlightId: string) {
  return `${QA_REAL_HIGHLIGHT_ID_PREFIX}${actualHighlightId}`;
}

export function isQaRealHighlightId(id: string) {
  return id.startsWith(QA_REAL_HIGHLIGHT_ID_PREFIX);
}

export function parseQaRealHighlightId(id: string) {
  return id.slice(QA_REAL_HIGHLIGHT_ID_PREFIX.length);
}

export function mapQaRealDocument(document: DocumentDetail): DocumentDetail {
  return {
    ...document,
    id: toQaRealDocumentId(document.id),
  };
}

export function mapQaRealHighlight(highlight: HighlightRecord): HighlightRecord {
  return {
    ...highlight,
    id: toQaRealHighlightId(highlight.id),
    documentId: toQaRealDocumentId(highlight.documentId),
  };
}
