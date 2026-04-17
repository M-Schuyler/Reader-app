"use client";

import { Fragment, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { resolveReaderImageUrl } from "@/lib/content/image-proxy";
import { resolveHighlightTextRanges, splitTextByHighlights } from "@/lib/highlights/anchor";
import { splitPlainTextIntoHighlightedParagraphs } from "@/lib/highlights/plain-text";
import { shouldRenderTextNode, type TextNeighborKind } from "@/lib/highlights/whitespace";
import type { ReaderHighlight } from "@/components/reader/reader-highlights";
import type { TocItem } from "./use-reader-toc";
import { ReaderCodeBlock } from "./reader-code-block";

type ReaderRichContentProps = {
  contentHtml: string;
  fallbackText: string;
  highlights?: ReaderHighlight[];
  sourceUrl: string | null;
  tocItems?: TocItem[];
};

type CursorState = {
  value: number;
};

type ResolvedReaderHighlight = Pick<ReaderHighlight, "id" | "quoteText" | "startOffset" | "endOffset">;

export function ReaderRichContent({
  contentHtml,
  fallbackText,
  highlights = [],
  sourceUrl,
  tocItems = [],
}: ReaderRichContentProps) {
  const [content, setContent] = useState<ReactNode | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    setContent(renderStructuredContent(contentHtml, fallbackText, sourceUrl, highlights, tocItems));
  }, [contentHtml, fallbackText, highlights, sourceUrl, tocItems]);

  if (!content) {
    return (
      <div className="reader-prose">
        {renderPlainTextFallback(fallbackText, highlights)}
      </div>
    );
  }

  return (
    <div className="reader-prose reader-rich-content">
      {content}
    </div>
  );
}

function resolveUrl(value: string | null, sourceUrl: string | null) {
  if (!value) {
    return null;
  }

  try {
    const resolved = sourceUrl ? new URL(value, sourceUrl) : new URL(value);
    if (!["http:", "https:"].includes(resolved.protocol)) {
      return null;
    }

    return resolved.toString();
  } catch {
    return null;
  }
}

function renderStructuredContent(
  contentHtml: string,
  fallbackText: string,
  sourceUrl: string | null,
  highlights: ReaderHighlight[],
  tocItems: TocItem[],
) {
  const parser = new DOMParser();
  const parsed = parser.parseFromString(contentHtml, "text/html");
  const resolvedHighlights = resolveHighlightTextRanges(parsed.body.textContent || fallbackText, highlights);
  const cursor: CursorState = { value: 0 };
  const headerCursor = { value: 0 };
  const nodes = Array.from(parsed.body.childNodes)
    .map((node, index) => renderNode(node, `${index}`, sourceUrl, resolvedHighlights, cursor, tocItems, headerCursor))
    .filter((node): node is ReactNode => node !== null);

  return nodes.length > 0 ? nodes : null;
}

function renderNode(
  node: Node,
  key: string,
  sourceUrl: string | null,
  highlights: ResolvedReaderHighlight[],
  cursor: CursorState,
  tocItems: TocItem[],
  headerCursor: { value: number },
): ReactNode | null {
  if (node.nodeType === Node.TEXT_NODE) {
    const textContent = node.textContent ?? "";
    const startOffset = cursor.value;
    const endOffset = startOffset + textContent.length;
    cursor.value = endOffset;

    if (!shouldRenderTextNode(textContent, resolveWhitespaceContext(node))) {
      return null;
    }

    return renderTextWithHighlights(textContent, key, highlights, startOffset, endOffset);
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return null;
  }

  const element = node as HTMLElement;
  const tagName = element.tagName.toLowerCase();

  if (["script", "style", "noscript", "iframe", "object", "embed", "svg", "form"].includes(tagName)) {
    return null;
  }

  const children = Array.from(element.childNodes)
    .map((child, index) => renderNode(child, `${key}.${index}`, sourceUrl, highlights, cursor, tocItems, headerCursor))
    .filter((child): child is ReactNode => child !== null);

  switch (tagName) {
    case "article":
    case "main":
    case "section":
    case "div":
    case "span":
      return <Fragment key={key}>{children}</Fragment>;

    case "p":
      return <div className="leading-relaxed" key={key}>{children}</div>;

    case "h1": {
      const headerId = tocItems[headerCursor.value]?.id;
      headerCursor.value++;
      return (
        <h2 className="font-display text-[2rem] leading-tight tracking-[-0.03em] text-[color:var(--text-primary)] sm:text-[2.35rem]" id={headerId} key={key}>
          {children}
        </h2>
      );
    }

    case "h2": {
      const headerId = tocItems[headerCursor.value]?.id;
      headerCursor.value++;
      return (
        <h3 className="font-display text-[1.65rem] leading-tight tracking-[-0.025em] text-[color:var(--text-primary)] sm:text-[1.85rem]" id={headerId} key={key}>
          {children}
        </h3>
      );
    }

    case "h3":
    case "h4":
    case "h5":
    case "h6": {
      const headerId = (tagName === "h3") ? tocItems[headerCursor.value]?.id : undefined;
      if (tagName === "h3") headerCursor.value++;
      return (
        <h4 className="font-display text-[1.3rem] leading-tight tracking-[-0.02em] text-[color:var(--text-primary)]" id={headerId} key={key}>
          {children}
        </h4>
      );
    }

    case "ul":
      return (
        <ul className="list-disc space-y-3 pl-6" key={key}>
          {children}
        </ul>
      );

    case "ol":
      return (
        <ol className="list-decimal space-y-3 pl-6" key={key}>
          {children}
        </ol>
      );

    case "li":
      return <li key={key}>{children}</li>;

    case "blockquote":
      return (
        <blockquote
          className="relative border-l-[3px] border-[color:var(--ai-card-accent)] bg-[color:var(--ai-card-bg)] py-4 pl-6 pr-4 italic text-[color:var(--text-secondary)] rounded-r-xl"
          key={key}
        >
          {children}
        </blockquote>
      );

    case "strong":
    case "b":
      return (
        <strong className="font-semibold text-[color:var(--text-primary)]" key={key}>
          {children}
        </strong>
      );

    case "em":
    case "i":
      return (
        <em className="italic" key={key}>
          {children}
        </em>
      );

    case "u":
      return (
        <u className="underline decoration-[color:var(--border-strong)] underline-offset-[0.18em]" key={key}>
          {children}
        </u>
      );

    case "del":
      return (
        <del className="text-[color:var(--text-secondary)] decoration-[color:var(--text-tertiary)]" key={key}>
          {children}
        </del>
      );

    case "sup":
      return (
        <sup className="align-super text-[0.72em]" key={key}>
          {children}
        </sup>
      );

    case "sub":
      return (
        <sub className="align-sub text-[0.72em]" key={key}>
          {children}
        </sub>
      );

    case "a": {
      const href = resolveUrl(element.getAttribute("href"), sourceUrl);
      if (!href) {
        return <Fragment key={key}>{children}</Fragment>;
      }

      return (
        <a
          className="underline decoration-[color:var(--border-strong)] underline-offset-[0.22em] transition hover:text-[color:var(--text-primary-strong)]"
          href={href}
          key={key}
          rel="noreferrer"
          target="_blank"
        >
          {children}
        </a>
      );
    }

    case "br":
      return <br key={key} />;

    case "hr":
      return <hr className="border-0 border-t border-[color:var(--border-subtle)]" key={key} />;

    case "pre":
      return <ReaderCodeBlock code={element.textContent ?? ""} key={key} />;

    case "code":
      return (
        <code
          className="rounded-[8px] bg-[color:var(--bg-surface)] px-1.5 py-0.5 font-mono text-[0.92em] text-[color:var(--text-primary)]"
          key={key}
        >
          {element.textContent ?? ""}
        </code>
      );

    case "figure":
      return (
        <figure className="space-y-3" key={key}>
          {children}
        </figure>
      );

    case "figcaption":
      return (
        <figcaption className="text-sm leading-6 text-[color:var(--text-tertiary)]" key={key}>
          {children}
        </figcaption>
      );

    case "table":
      return (
        <div className="reader-table-wrap" key={key}>
          <table className="reader-table">{children}</table>
        </div>
      );

    case "thead":
      return <thead key={key}>{children}</thead>;

    case "tbody":
      return <tbody key={key}>{children}</tbody>;

    case "tr":
      return <tr key={key}>{children}</tr>;

    case "th":
      return <th key={key}>{children}</th>;

    case "td":
      return <td key={key}>{children}</td>;

    case "caption":
      return <caption key={key}>{children}</caption>;

    case "img": {
      const src = resolveReaderImageUrl(element.getAttribute("src"), sourceUrl);
      if (!src) {
        return null;
      }

      const alt = element.getAttribute("alt") ?? "";

      return (
        <figure className="group relative my-10 overflow-hidden" key={key}>
          <img
            alt={alt}
            className="w-full cursor-zoom-in rounded-[22px] border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] transition-transform duration-300 hover:scale-[1.01]"
            loading="lazy"
            onClick={(e) => {
              const img = e.currentTarget;
              if (img.classList.contains('is-expanded')) {
                img.classList.remove('is-expanded', 'fixed', 'inset-0', 'z-[100]', 'm-auto', 'max-h-[90vh]', 'max-w-[90vw]', 'object-contain', 'bg-black/80', 'p-4', 'rounded-none', 'border-none');
              } else {
                // Simplified inline lightbox logic
                window.open(src, '_blank');
              }
            }}
            referrerPolicy="no-referrer"
            src={src}
          />
          {alt && (
            <figcaption className="mt-4 text-center text-[13px] italic text-[color:var(--text-tertiary)]">
              {alt}
            </figcaption>
          )}
        </figure>
      );
    }

    default:
      return children.length > 0 ? <Fragment key={key}>{children}</Fragment> : null;
  }
}

function renderPlainTextFallback(sourceText: string, highlights: ReaderHighlight[]) {
  const resolvedHighlights = resolveHighlightTextRanges(sourceText, highlights);
  const paragraphs = splitPlainTextIntoHighlightedParagraphs(
    sourceText,
    resolvedHighlights
      .filter((highlight) => typeof highlight.startOffset === "number" && typeof highlight.endOffset === "number")
      .map((highlight) => ({
        id: highlight.id,
        startOffset: highlight.startOffset,
        endOffset: highlight.endOffset,
        quoteText: highlight.quoteText,
      })),
  );

  return paragraphs.map((paragraph) => (
    <p className="whitespace-pre-wrap" key={`fallback-${paragraph.index}`}>
      {paragraph.segments.map((segment, index) =>
        segment.type === "highlight" ? (
          <mark
            className={highlightClassName}
            data-highlight-id={segment.id}
            id={`highlight-${segment.id}`}
            key={`plain-highlight-${paragraph.index}-${segment.id}-${index}`}
          >
            {segment.text}
          </mark>
        ) : (
          <Fragment key={`plain-text-${paragraph.index}-${index}`}>{segment.text}</Fragment>
        ),
      )}
    </p>
  ));
}

function renderTextWithHighlights(
  textContent: string,
  key: string,
  highlights: ResolvedReaderHighlight[],
  startOffset: number,
  endOffset: number,
): ReactNode | null {
  const overlappingHighlights = highlights
    .filter((highlight) => typeof highlight.startOffset === "number" && typeof highlight.endOffset === "number")
    .filter((highlight) => {
      const highlightStart = highlight.startOffset ?? 0;
      const highlightEnd = highlight.endOffset ?? highlightStart;
      return highlightEnd > startOffset && highlightStart < endOffset;
    })
    .map((highlight) => ({
      id: highlight.id,
      quoteText: highlight.quoteText,
      startOffset: Math.max(0, (highlight.startOffset ?? 0) - startOffset),
      endOffset: Math.min(textContent.length, (highlight.endOffset ?? 0) - startOffset),
    }));

  if (overlappingHighlights.length === 0) {
    return textContent;
  }

  const segments = splitTextByHighlights(textContent, overlappingHighlights);

  return (
    <Fragment key={key}>
      {segments.map((segment, index) =>
        segment.type === "highlight" ? (
          <mark 
            className={highlightClassName} 
            data-highlight-id={segment.id} 
            id={`highlight-${segment.id}`}
            key={`${key}.highlight.${segment.id}.${index}`}
          >
            {segment.text}
          </mark>
        ) : (
          <Fragment key={`${key}.text.${index}`}>{segment.text}</Fragment>
        ),
      )}
    </Fragment>
  );
}

const highlightClassName =
  "rounded-[0.48rem] bg-[color:var(--highlight-mark-bg)] px-[0.12em] py-[0.05em] text-[color:var(--text-primary)]";

function resolveWhitespaceContext(node: Node) {
  return {
    previous: resolveSiblingKind(node.previousSibling, "previous"),
    next: resolveSiblingKind(node.nextSibling, "next"),
  } satisfies {
    previous: TextNeighborKind;
    next: TextNeighborKind;
  };
}

function resolveSiblingKind(node: Node | null, direction: "previous" | "next"): TextNeighborKind {
  if (!node) {
    return "none";
  }

  if (node.nodeType === Node.TEXT_NODE) {
    const textContent = node.textContent ?? "";

    if (textContent.trim().length === 0) {
      return resolveSiblingKind(direction === "previous" ? node.previousSibling : node.nextSibling, direction);
    }

    return "text";
  }

  if (node.nodeType !== Node.ELEMENT_NODE) {
    return resolveSiblingKind(direction === "previous" ? node.previousSibling : node.nextSibling, direction);
  }

  const tagName = (node as HTMLElement).tagName.toLowerCase();
  return blockElementTags.has(tagName) ? "block" : "inline";
}

const blockElementTags = new Set([
  "article",
  "main",
  "section",
  "div",
  "p",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "blockquote",
  "hr",
  "pre",
  "figure",
  "figcaption",
]);
