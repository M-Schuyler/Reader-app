import Link from "next/link";
import { IngestionStatus } from "@prisma/client";
import type { GetDocumentsResponseData } from "@/server/modules/documents/document.types";

type DocumentListProps = {
  data: GetDocumentsResponseData;
};

export function DocumentList({ data }: DocumentListProps) {
  if (data.items.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-black/15 bg-white/55 p-8 text-sm text-black/55">
        No documents yet. Save a web URL to create the first record in the library.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {data.items.map((item) => (
        <DocumentCard item={item} key={item.id} />
      ))}
    </div>
  );
}

function DocumentCard({ item }: { item: GetDocumentsResponseData["items"][number] }) {
  const isFailed = item.ingestionStatus === IngestionStatus.FAILED;
  const supportText = resolveSupportText(item);

  return (
    <Link
      className="block rounded-3xl border border-black/10 bg-white/80 p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-black/20"
      href={`/documents/${item.id}`}
    >
      <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-black/45">
        <span>{item.type}</span>
        <span className={statusClassName(item.ingestionStatus)}>{formatIngestionStatus(item.ingestionStatus)}</span>
        <span>{formatDate(item.createdAt)}</span>
      </div>

      <h3 className="mt-3 font-serif text-2xl text-black/90">{item.title}</h3>

      {!isFailed && supportText ? <p className="mt-3 line-clamp-4 text-sm leading-6 text-black/68">{supportText}</p> : null}

      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-black/55">
        {!isFailed && item.wordCount ? <span>{item.wordCount} words</span> : null}
        {item.lang ? <span>{item.lang}</span> : null}
        {item.canonicalUrl ? (
          <span className="truncate">{truncateUrl(item.canonicalUrl)}</span>
        ) : item.sourceUrl ? (
          <span className="truncate">{truncateUrl(item.sourceUrl)}</span>
        ) : null}
      </div>
    </Link>
  );
}

function resolveSupportText(item: GetDocumentsResponseData["items"][number]) {
  if (item.ingestionStatus === IngestionStatus.FAILED) {
    return null;
  }

  if (item.isFavorite) {
    return item.aiSummary ?? "已收藏，AI 摘要生成中。";
  }

  return item.excerpt;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    year: "numeric",
    month: "short",
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

function truncateUrl(value: string) {
  try {
    const url = new URL(value);
    return `${url.hostname}${url.pathname === "/" ? "" : url.pathname}`;
  } catch {
    return value;
  }
}
