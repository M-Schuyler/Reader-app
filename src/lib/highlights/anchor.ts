type HighlightRange = {
  id: string;
  startOffset: number | null;
  endOffset: number | null;
  quoteText: string;
};

type ResolvedRangeSpan = {
  start: number;
  end: number;
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

export function resolveHighlightTextRanges(sourceText: string, highlights: HighlightRange[]): HighlightRange[] {
  if (highlights.length === 0 || sourceText.length === 0) {
    return highlights.filter(hasExplicitOffsets);
  }

  const searchableSource = buildSearchableText(sourceText);
  const occupiedRanges: ResolvedRangeSpan[] = [];
  const resolvedHighlights: HighlightRange[] = [];

  for (const highlight of highlights) {
    if (hasExplicitOffsets(highlight)) {
      occupiedRanges.push({
        start: highlight.startOffset,
        end: highlight.endOffset,
      });
      resolvedHighlights.push(highlight);
      continue;
    }

    const normalizedQuote = buildSearchableText(highlight.quoteText).value;
    if (!normalizedQuote) {
      continue;
    }

    const match = findNextRangeMatch(searchableSource, normalizedQuote, occupiedRanges);
    if (!match) {
      continue;
    }

    occupiedRanges.push(match);
    resolvedHighlights.push({
      ...highlight,
      startOffset: match.start,
      endOffset: match.end,
    });
  }

  return resolvedHighlights;
}

function findNextRangeMatch(
  searchableSource: ReturnType<typeof buildSearchableText>,
  normalizedQuote: string,
  occupiedRanges: ResolvedRangeSpan[],
) {
  let searchIndex = 0;

  while (searchIndex < searchableSource.value.length) {
    const normalizedMatchIndex = searchableSource.value.indexOf(normalizedQuote, searchIndex);
    if (normalizedMatchIndex === -1) {
      return null;
    }

    const normalizedMatchEnd = normalizedMatchIndex + normalizedQuote.length - 1;
    const match = {
      start: searchableSource.spans[normalizedMatchIndex]?.start ?? 0,
      end: searchableSource.spans[normalizedMatchEnd]?.end ?? 0,
    };

    if (match.end > match.start && !occupiedRanges.some((range) => rangesOverlap(range, match))) {
      return match;
    }

    searchIndex = normalizedMatchIndex + 1;
  }

  return null;
}

function rangesOverlap(left: ResolvedRangeSpan, right: ResolvedRangeSpan) {
  return left.start < right.end && right.start < left.end;
}

function hasExplicitOffsets(highlight: HighlightRange): highlight is HighlightRange & { startOffset: number; endOffset: number } {
  return (
    Number.isInteger(highlight.startOffset) &&
    Number.isInteger(highlight.endOffset) &&
    (highlight.startOffset ?? 0) >= 0 &&
    (highlight.endOffset ?? 0) > (highlight.startOffset ?? 0)
  );
}

function buildSearchableText(value: string) {
  const normalizedCharacters: string[] = [];
  const spans: ResolvedRangeSpan[] = [];

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index] ?? "";

    if (isWhitespace(character)) {
      let runEnd = index + 1;

      while (runEnd < value.length && isWhitespace(value[runEnd] ?? "")) {
        runEnd += 1;
      }

      index = runEnd - 1;
      continue;
    }

    if (isDashLike(character)) {
      const runStart = index;
      let runEnd = index + 1;

      while (runEnd < value.length && isDashLike(value[runEnd] ?? "")) {
        runEnd += 1;
      }

      normalizedCharacters.push("-");
      spans.push({
        start: runStart,
        end: runEnd,
      });
      index = runEnd - 1;
      continue;
    }

    normalizedCharacters.push(normalizeCharacter(character));
    spans.push({
      start: index,
      end: index + 1,
    });
  }

  return {
    value: normalizedCharacters.join(""),
    spans,
  };
}

function isWhitespace(value: string) {
  return /\s/u.test(value);
}

function isDashLike(value: string) {
  return /[-\u2010-\u2015\u2212\u2E3A\u2E3B]/u.test(value);
}

function normalizeCharacter(value: string) {
  if (["“", "”", "„", "‟", "＂"].includes(value)) {
    return '"';
  }

  if (["‘", "’", "‚", "‛", "＇"].includes(value)) {
    return "'";
  }

  return value;
}
