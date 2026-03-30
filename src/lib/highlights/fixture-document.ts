import { AiSummaryStatus, DocumentType, IngestionStatus, ReadState } from "@prisma/client";
import type { DocumentDetail } from "@/server/modules/documents/document.types";

export const QA_HIGHLIGHTS_DOCUMENT_ID = "qa-highlights-document";

export function isHighlightsQaFixtureId(id: string) {
  return id === QA_HIGHLIGHTS_DOCUMENT_ID;
}

export function getHighlightsQaFixtureDocument(): DocumentDetail {
  return {
    id: QA_HIGHLIGHTS_DOCUMENT_ID,
    type: DocumentType.WEB_PAGE,
    title: "Reader keeps reading traces stable.",
    sourceUrl: "https://reader.local/qa/highlights-document",
    canonicalUrl: "https://reader.local/qa/highlights-document",
    aiSummary:
      "This fixture exists to verify that selection anchoring, note editing, and reload persistence stay reliable on the real Reader surface.",
    aiSummaryStatus: AiSummaryStatus.READY,
    aiSummaryError: null,
    excerpt:
      "Use this page to validate real Reader highlighting without depending on database connectivity or external content drift.",
    lang: "en",
    author: "Reader QA Fixture",
    publishedAt: "2026-03-27T10:00:00.000Z",
    publishedAtKind: "EXACT",
    enteredReadingAt: "2026-03-27T10:10:00.000Z",
    readState: ReadState.UNREAD,
    isFavorite: false,
    ingestionStatus: IngestionStatus.READY,
    createdAt: "2026-03-27T10:00:00.000Z",
    updatedAt: "2026-03-27T10:00:00.000Z",
    source: null,
    feed: null,
    file: null,
    content: {
      contentHtml: `
        <article>
          <p>
            Reader keeps <strong>structure</strong> intact across inline passages so highlight anchors stay readable.
          </p>
          <p>
            A useful highlight should survive refresh, allow a short note, and stay visually quiet inside the reading
            column. The goal here is not more chrome, but a calmer trace you can come back to later.
          </p>
          <blockquote>
            Keep the passage small enough to be worth exporting, and specific enough to be worth revisiting.
          </blockquote>
          <ul>
            <li>Selection should feel direct.</li>
            <li>Whitespace should not collapse across inline nodes.</li>
            <li>Notes should stay attached to the passage.</li>
          </ul>
        </article>
      `.trim(),
      plainText: [
        "Reader keeps structure intact across inline passages so highlight anchors stay readable.",
        "A useful highlight should survive refresh, allow a short note, and stay visually quiet inside the reading column. The goal here is not more chrome, but a calmer trace you can come back to later.",
        "Keep the passage small enough to be worth exporting, and specific enough to be worth revisiting.",
        "Selection should feel direct.",
        "Whitespace should not collapse across inline nodes.",
        "Notes should stay attached to the passage.",
      ].join("\n\n"),
      wordCount: 59,
      extractedAt: "2026-03-27T10:00:00.000Z",
    },
  };
}
