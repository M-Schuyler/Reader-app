type HighlightRange = {
  id: string;
  startOffset: number | null;
  endOffset: number | null;
  quoteText: string;
};

export type HighlightSegment =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "highlight";
      id: string;
      text: string;
    };

export function buildTextAnchor(sourceText: string, startOffset: number, endOffset: number) {
  if (!Number.isInteger(startOffset) || !Number.isInteger(endOffset) || startOffset < 0 || endOffset <= startOffset) {
    throw new Error("Invalid highlight offset range.");
  }

  if (endOffset > sourceText.length) {
    throw new Error("Highlight range exceeds source text length.");
  }

  return {
    quoteText: sourceText.slice(startOffset, endOffset),
    startOffset,
    endOffset,
    selectorJson: null,
  };
}

export function splitTextByHighlights(sourceText: string, highlights: HighlightRange[]): HighlightSegment[] {
  const orderedHighlights = highlights
    .filter((highlight) => highlight.startOffset !== null && highlight.endOffset !== null)
    .sort((a, b) => (a.startOffset ?? 0) - (b.startOffset ?? 0));

  const segments: HighlightSegment[] = [];
  let cursor = 0;

  for (const highlight of orderedHighlights) {
    const startOffset = highlight.startOffset ?? 0;
    const endOffset = highlight.endOffset ?? startOffset;

    if (startOffset < cursor || startOffset >= endOffset) {
      continue;
    }

    if (cursor < startOffset) {
      segments.push({
        type: "text",
        text: sourceText.slice(cursor, startOffset),
      });
    }

    segments.push({
      type: "highlight",
      id: highlight.id,
      text: sourceText.slice(startOffset, endOffset),
    });

    cursor = endOffset;
  }

  if (cursor < sourceText.length) {
    segments.push({
      type: "text",
      text: sourceText.slice(cursor),
    });
  }

  return segments;
}
