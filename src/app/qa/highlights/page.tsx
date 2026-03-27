import { notFound } from "next/navigation";
import { HighlightsPlayground } from "@/components/reader/highlights-playground";

export default function HighlightsPlaygroundPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return <HighlightsPlayground />;
}
