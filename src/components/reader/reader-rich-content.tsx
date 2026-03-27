"use client";

import { Fragment, useEffect, useState, type ReactNode } from "react";

type ReaderRichContentProps = {
  contentHtml: string;
  fallbackText: string;
  sourceUrl: string | null;
};

export function ReaderRichContent({ contentHtml, fallbackText, sourceUrl }: ReaderRichContentProps) {
  const [content, setContent] = useState<ReactNode | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    setContent(renderStructuredContent(contentHtml, sourceUrl));
  }, [contentHtml, sourceUrl]);

  if (!content) {
    return (
      <div className="reader-prose">
        {fallbackText
          .split(/\n{2,}/)
          .filter((paragraph) => paragraph.trim().length > 0)
          .map((paragraph, index) => (
            <p key={`fallback-${index}`}>{paragraph}</p>
          ))}
      </div>
    );
  }

  return <div className="reader-prose reader-rich-content">{content}</div>;
}

function renderStructuredContent(contentHtml: string, sourceUrl: string | null) {
  const parser = new DOMParser();
  const parsed = parser.parseFromString(contentHtml, "text/html");
  const nodes = Array.from(parsed.body.childNodes)
    .map((node, index) => renderNode(node, `${index}`, sourceUrl))
    .filter((node): node is ReactNode => node !== null);

  return nodes.length > 0 ? nodes : null;
}

function renderNode(node: Node, key: string, sourceUrl: string | null): ReactNode | null {
  if (node.nodeType === Node.TEXT_NODE) {
    const textContent = node.textContent ?? "";
    return textContent.trim().length > 0 ? textContent : null;
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
    .map((child, index) => renderNode(child, `${key}.${index}`, sourceUrl))
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

    case "img": {
      const src = resolveUrl(element.getAttribute("src"), sourceUrl);
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
          src={src}
        />
      );
    }

    default:
      return children.length > 0 ? <Fragment key={key}>{children}</Fragment> : null;
  }
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
