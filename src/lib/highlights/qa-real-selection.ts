type QaRealDocumentCandidate = {
  id: string;
  highlightCount: number;
};

export function pickQaRealDocumentCandidate(candidates: QaRealDocumentCandidate[]) {
  return candidates.find((candidate) => candidate.highlightCount === 0)?.id ?? null;
}
