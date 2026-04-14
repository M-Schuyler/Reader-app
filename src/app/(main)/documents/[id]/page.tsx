import { notFound } from "next/navigation";
import { DocumentReader } from "@/components/reader/document-reader";
import { openReaderDocument } from "@/server/modules/documents/document.service";

export const dynamic = "force-dynamic";

type DocumentPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function DocumentPage({ params, searchParams }: DocumentPageProps) {
  const [resolvedParams, resolvedSearchParams] = await Promise.all([params, searchParams]);
  const data = await openReaderDocument(resolvedParams.id, {
    searchParams: resolvedSearchParams as Record<string, string | undefined>,
  });

  if (!data) {
    notFound();
  }

  return <DocumentReader document={data.document} nextUp={data.nextUp} />;
}
