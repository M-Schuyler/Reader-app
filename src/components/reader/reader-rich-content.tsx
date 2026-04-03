"use client";

import { Fragment, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { resolveReaderImageUrl } from "@/lib/content/image-proxy";
import { splitTextByHighlights } from "@/lib/highlights/anchor";
import { splitPlainTextIntoHighlightedParagraphs } from "@/lib/highlights/plain-text";
import { shouldRenderTextNode, type TextNeighborKind } from "@/lib/highlights/whitespace";
import type { ReaderHighlight } from "@/components/reader/reader-highlights";

type ReaderRichContentProps = {
  contentHtml: string;
  fallbackText: string;
  fontSize?: string;
  highlights?: ReaderHighlight[];
  lineHeight?: string;
  sourceUrl: string | null;
};

type CursorState = {
  value: number;
};

export function ReaderRichContent({
  contentHtml,
  fallbackText,
  fontSize = "1.125rem",
  highlights = [],
  lineHeight = "2",
  sourceUrl,
}: ReaderRichContentProps) {
  const [content, setContent] = useState<ReactNode | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    setContent(renderStructuredContent(contentHtml, sourceUrl, highlights));
  }, [contentHtml, highlights, sourceUrl]);

  if (!content) {
    return (
      <div
        className="reader-prose"
        style={
          {
            "--reader-font-size": fontSize,
            "--reader-line-height": lineHeight,
          } as CSSProperties
        }
      >
        {renderPlainTextFallback(fallbackText, highlights)}
      </div>
    );
  }

  return (
    <div
      className="reader-prose reader-rich-content"
      style={
        {
          "--reader-font-size": fontSize,
          "--reader-line-height": lineHeight,
        } as CSSProperties
      }
    >
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

function renderStructuredContent(contentHtml: string, sourceUrl: string | null, highlights: ReaderHighlight[]) {
  const parser = new DOMParser();
  const parsed = parser.parseFromString(contentHtml, "text/html");
  const cursor: CursorState = { value: 0 };
  const nodes = Array.from(parsed.body.childNodes)
    .map((node, index) => renderNode(node, `${index}`, sourceUrl, highlights, cursor))
    .filter((node): node is ReactNode => node !== null);

  return nodes.length > 0 ? nodes : null;
}

function renderNode(
  node: Node,
  key: string,
  sourceUrl: string | null,
  highlights: ReaderHighlight[],
  cursor: CursorState,
): ReactNode | null {
  if (node.nodeType === Node.TEXT_NODE) {
    const textContent = node.textContent ?? "";
    if (!shouldRenderTextNode(textContent, resolveWhitespaceContext(node))) {
      return null;
    }

    return renderTextWithHighlights(textContent, key, highlights, cursor);
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
    .map((child, index) => renderNode(child, `${key}.${index}`, sourceUrl, highlights, cursor))
    .filter((child): child is ReactNode => child !== null);

  switch (tagName) {
    case "article":
    case "main":
    case "section":
    case "div":
    case "span":
      return <Fragment key={key}>{children}</Fragment>;

    case "p":
      return <p key={key}>{children}</p>;

    case "h1":
      return (
        <h2 className="font-display text-[2rem] leading-tight tracking-[-0.03em] text-[color:var(--text-primary)] sm:text-[2.35rem]" key={key}>
          {children}
        </h2>
      );

    case "h2":
      return (
        <h3 className="font-display text-[1.65rem] leading-tight tracking-[-0.025em] text-[color:var(--text-primary)] sm:text-[1.85rem]" key={key}>
          {children}
        </h3>
      );

    case "h3":
    case "h4":
    case "h5":
    case "h6":
      return (
        <h4 className="font-display text-[1.3rem] leading-tight tracking-[-0.02em] text-[color:var(--text-primary)]" key={key}>
          {children}
        </h4>
      );

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
          className="border-l border-[color:var(--border-strong)] pl-5 text-[color:var(--text-secondary)]"
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
      return (
        <pre
          className="overflow-x-auto rounded-[22px] border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] p-5 font-mono text-[0.95rem] leading-7 text-[color:var(--text-primary)]"
          key={key}
        >
          <code>{element.textContent ?? ""}</code>
        </pre>
      );

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
        <img
          alt={alt}
          className="w-full rounded-[22px] border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)]"
          key={key}
          loading="lazy"
          referrerPolicy="no-referrer"
          src={src}
        />
      );
    }

    default:
      return children.length > 0 ? <Fragment key={key}>{children}</Fragment> : null;
  }
}

function renderPlainTextFallback(sourceText: string, highlights: ReaderHighlight[]) {
  const paragraphs = splitPlainTextIntoHighlightedParagraphs(
    sourceText,
    highlights
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
  highlights: ReaderHighlight[],
  cursor: CursorState,
): ReactNode | null {
  const startOffset = cursor.value;
  const endOffset = startOffset + textContent.length;
  cursor.value = endOffset;

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
          <mark className={highlightClassName} data-highlight-id={segment.id} key={`${key}.highlight.${segment.id}.${index}`}>
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
