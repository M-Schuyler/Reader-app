import { splitTextByHighlights, type HighlightSegment } from "./anchor";

type HighlightRange = {
  id: string;
  quoteText: string;
  startOffset: number | null;
  endOffset: number | null;
};

export type PlainTextParagraph = {
  index: number;
  segments: HighlightSegment[];
};

export function splitPlainTextIntoHighlightedParagraphs(
  sourceText: string,
  highlights: HighlightRange[],
): PlainTextParagraph[] {
  const paragraphRanges = collectParagraphRanges(sourceText);

  return paragraphRanges.map((paragraph, index) => ({
    index,
    segments: splitTextByHighlights(
      paragraph.text,
      highlights
        .filter((highlight) => typeof highlight.startOffset === "number" && typeof highlight.endOffset === "number")
        .filter((highlight) => {
          const startOffset = highlight.startOffset ?? 0;
          const endOffset = highlight.endOffset ?? startOffset;
          return endOffset > paragraph.startOffset && startOffset < paragraph.endOffset;
        })
        .map((highlight) => ({
          id: highlight.id,
          quoteText: highlight.quoteText,
          startOffset: Math.max(0, (highlight.startOffset ?? 0) - paragraph.startOffset),
          endOffset: Math.min(paragraph.text.length, (highlight.endOffset ?? 0) - paragraph.startOffset),
        })),
    ),
  }));
}

function collectParagraphRanges(sourceText: string) {
  const paragraphs: Array<{ text: string; startOffset: number; endOffset: number }> = [];
  const separator = /\n{2,}/g;
  let cursor = 0;

  for (const match of sourceText.matchAll(separator)) {
    pushParagraph(paragraphs, sourceText.slice(cursor, match.index), cursor);
    cursor = (match.index ?? cursor) + match[0].length;
  }

  pushParagraph(paragraphs, sourceText.slice(cursor), cursor);

  return paragraphs;
}

function pushParagraph(
  paragraphs: Array<{ text: string; startOffset: number; endOffset: number }>,
  text: string,
  startOffset: number,
) {
  if (text.trim().length === 0) {
    return;
  }

  paragraphs.push({
    text,
    startOffset,
    endOffset: startOffset + text.length,
  });
}
