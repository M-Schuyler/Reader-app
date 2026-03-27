import { notFound, redirect } from "next/navigation";
import { DocumentReader } from "@/components/reader/document-reader";
import { getQaRealReaderDocument } from "@/server/modules/highlights/highlight-qa-real.service";

type QaRealReaderHighlightsPageProps = {
  searchParams: Promise<{
    id?: string;
  }>;
};

export default async function QaRealReaderHighlightsPage({ searchParams }: QaRealReaderHighlightsPageProps) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const resolvedSearchParams = await searchParams;
  const data = await getQaRealReaderDocument(resolvedSearchParams.id);

  if (!data) {
    notFound();
  }

  if (!resolvedSearchParams.id) {
    redirect(`/qa/documents/highlights/real?id=${encodeURIComponent(data.actualId)}`);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[18px] border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] px-4 py-3 text-sm leading-6 text-[color:var(--text-secondary)]">
        Running against a real local document.
        <span className="ml-2 font-mono text-[13px] text-[color:var(--text-primary)]">{data.actualId}</span>
      </div>
      <DocumentReader document={data.document} />
    </div>
  );
}
