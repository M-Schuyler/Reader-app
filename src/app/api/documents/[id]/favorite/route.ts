import { RouteError, handleRouteError, ok } from "@/server/api/response";
import { requireApiUser } from "@/server/auth/session";
import {
  parseUpdateDocumentFavoriteInput,
  updateDocumentFavoriteStatus,
} from "@/server/modules/documents/document.service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    await requireApiUser();
    const { id } = await context.params;
    const body = parseUpdateDocumentFavoriteInput(await parseJsonBody(request));
    const data = await updateDocumentFavoriteStatus(id, body);

    if (!data) {
      throw new RouteError("DOCUMENT_NOT_FOUND", 404, "Document was not found.");
    }

    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}

async function parseJsonBody(request: Request) {
  try {
    return await request.json();
  } catch {
    throw new RouteError("INVALID_BODY", 400, "Request body must be valid JSON.");
  }
}
