import { handleRouteError } from "@/server/api/response";
import { readJsonBodyOrThrow } from "@/server/api/request";
import { requireApiUser } from "@/server/auth/session";
import {
  buildBatchDocumentDownloadArchive,
  parseBatchDocumentDownloadInput,
} from "@/server/modules/export/batch-document-export.service";

export async function POST(request: Request) {
  try {
    await requireApiUser();
    const body = await readJsonBodyOrThrow(request);
    const input = parseBatchDocumentDownloadInput(body);
    const archive = await buildBatchDocumentDownloadArchive(input);
    const payload = new Uint8Array(archive.content);

    return new Response(payload, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": buildContentDisposition(archive.fileName),
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
