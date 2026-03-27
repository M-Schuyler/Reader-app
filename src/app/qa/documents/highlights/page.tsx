import { notFound } from "next/navigation";
import { DocumentReader } from "@/components/reader/document-reader";
import { getHighlightsQaFixtureDocument } from "@/lib/highlights/fixture-document";

export default function QaReaderHighlightsDocumentPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <DocumentReader document={getHighlightsQaFixtureDocument()} />;
}
