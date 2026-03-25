"use client";

import Link from "next/link";
import { IngestionStatus } from "@prisma/client";
import {
  FavoriteSummaryBadge,
  FavoriteToggleButton,
  useDocumentFavoriteController,
} from "@/components/documents/favorite-control";
import type { DocumentDetail } from "@/server/modules/documents/document.types";

type DocumentReaderProps = {
  document: DocumentDetail;
};

export function DocumentReader({ document }: DocumentReaderProps) {
  const sourceUrl = document.sourceUrl ?? document.canonicalUrl;
  const hasExtractedContent = Boolean(document.content?.plainText.trim());
  const isFailed = document.ingestionStatus === IngestionStatus.FAILED;
  const isReadable = !isFailed && hasExtractedContent;
  const favorite = useDocumentFavoriteController(document);
  const paragraphs = isReadable ? document.content!.plainText.split(/\n{2,}/).filter((paragraph) => paragraph.trim().length > 0) : [];

  return (
    <article className="space-y-8">
      <header className="space-y-4 rounded-[2rem] border border-black/10 bg-white/80 p-8 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em] text-black/45">
          <span>{document.type}</span>
          <span className={statusClassName(document.ingestionStatus)}>{formatIngestionStatus(document.ingestionStatus)}</span>
          <span>{formatDate(document.createdAt)}</span>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3">
            <h2 className="max-w-4xl font-serif text-4xl leading-tight text-black/92">{document.title}</h2>
            <div className="flex flex-wrap items-center gap-2">
              <FavoriteSummaryBadge state={favorite.summaryState} />
            </div>
            {favorite.supportText ? <p className="max-w-3xl text-base leading-7 text-black/68">{favorite.supportText}</p> : null}
            {favorite.actionError ? <p className="text-sm text-red-700">{favorite.actionError}</p> : null}
          </div>

          <FavoriteToggleButton
            buttonLabel={favorite.buttonLabel}
            isFavorite={favorite.isFavorite}
            isSubmitting={favorite.isSubmitting}
            onClick={favorite.toggleFavorite}
          />
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm text-black/60">
          {document.lang ? <span>{document.lang}</span> : null}
          {isReadable && document.content?.wordCount ? <span>{document.content.wordCount} words</span> : null}
          {!isFailed && sourceUrl ? (
            <Link className="underline decoration-black/20 underline-offset-4" href={sourceUrl} target="_blank">
              Open source
            </Link>
          ) : null}
          <Link className="underline decoration-black/20 underline-offset-4" href="/library">
            Back to library
          </Link>
        </div>
      </header>

      <section className="rounded-[2rem] border border-black/10 bg-white/80 p-8 shadow-sm">
        {isFailed ? (
          <div className="space-y-5">
            <div className="space-y-2">
              <h3 className="font-serif text-2xl text-black/90">链接已保存，但正文抓取失败</h3>
              <p className="text-sm leading-6 text-black/62">
                当前这条记录已进入文档库，但还没有可供阅读的正文内容。
              </p>
            </div>

            {sourceUrl ? (
              <div className="space-y-3 rounded-3xl border border-black/10 bg-stone-50 px-5 py-4">
                <p className="text-xs uppercase tracking-[0.2em] text-black/45">Original URL</p>
                <p className="break-all text-sm leading-6 text-black/75">{sourceUrl}</p>
                <Link
                  className="inline-flex rounded-full border border-black/15 px-4 py-2 text-sm text-black/80 transition hover:border-black/30 hover:text-black"
                  href={sourceUrl}
                  target="_blank"
                >
                  打开原文
                </Link>
              </div>
            ) : null}
          </div>
        ) : paragraphs.length > 0 ? (
          <div className="space-y-6 font-serif text-lg leading-9 text-black/86">
            {paragraphs.map((paragraph, index) => (
              <p key={`${document.id}-${index}`}>{paragraph}</p>
            ))}
          </div>
        ) : (
          <p className="text-sm text-black/55">This document is saved, but readable content is not available yet.</p>
        )}
      </section>
    </article>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(value));
}

function formatIngestionStatus(status: IngestionStatus) {
  switch (status) {
    case IngestionStatus.FAILED:
      return "抓取失败";
    case IngestionStatus.READY:
      return "READY";
    case IngestionStatus.PROCESSING:
      return "PROCESSING";
    case IngestionStatus.PENDING:
    default:
      return "PENDING";
  }
}

function statusClassName(status: IngestionStatus) {
  if (status === IngestionStatus.FAILED) {
    return "rounded-full bg-red-50 px-2 py-0.5 text-red-700";
  }

  return "";
}
