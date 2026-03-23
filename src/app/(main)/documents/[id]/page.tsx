import { notFound } from "next/navigation";
import { DocumentReader } from "@/components/reader/document-reader";
import { getDocument } from "@/server/modules/documents/document.service";

export const dynamic = "force-dynamic";

type DocumentPageProps = {
  params: Promise<{ id: string }>;
};

export default async function DocumentPage({ params }: DocumentPageProps) {
  const resolvedParams = await params;
  const data = await getDocument(resolvedParams.id);

  if (!data) {
    notFound();
  }

  return <DocumentReader document={data.document} />;
}
