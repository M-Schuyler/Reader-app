import { readJsonBodyOrThrow } from "@/server/api/request";
import { RouteError, handleRouteError, ok } from "@/server/api/response";
import { requireApiUser } from "@/server/auth/session";
import { parseUpdateDocumentProgressInput, updateDocumentProgress } from "@/server/modules/documents/document.service";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    await requireApiUser();
    const { id } = await context.params;
    const { progress } = parseUpdateDocumentProgressInput(
      await readJsonBodyOrThrow(request, "Document progress payload must be valid JSON."),
    );
    const data = await updateDocumentProgress(id, progress);

    if (!data) {
      throw new RouteError("DOCUMENT_NOT_FOUND", 404, "Document was not found.");
    }

    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
