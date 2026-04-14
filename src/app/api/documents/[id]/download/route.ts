import { RouteError, handleRouteError } from "@/server/api/response";
import { requireApiUser } from "@/server/auth/session";
import { getDocument } from "@/server/modules/documents/document.service";
import { listHighlightsByDocumentId } from "@/server/modules/highlights/highlight.repository";
import {
  buildDocumentDownload,
  buildDocumentDownloadFileName,
  parseDocumentDownloadFormat,
} from "@/server/modules/export/document-export.service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    await requireApiUser();
    const { id } = await context.params;
    const documentData = await getDocument(id);

    if (!documentData) {
      throw new RouteError("DOCUMENT_NOT_FOUND", 404, "Document was not found.");
    }

    const format = parseDocumentDownloadFormat(new URL(request.url).searchParams.get("format"));
    const highlights = await listHighlightsByDocumentId(id);
    const download = buildDocumentDownload(documentData.document, format, {
      highlights: highlights.map((highlight) => ({
        quoteText: highlight.quoteText,
        note: highlight.note,
        color: highlight.color,
        createdAt: highlight.createdAt,
      })),
    });
    const fileName = buildDocumentDownloadFileName(documentData.document, format);

    return new Response(download.content, {
      status: 200,
      headers: {
        "Content-Type": download.contentType,
        "Content-Disposition": buildContentDisposition(fileName),
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

function buildContentDisposition(fileName: string) {
  const fallback = fileName.replace(/[^\x20-\x7E]/g, "_");
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
