import { readJsonBodyOrThrow } from "@/server/api/request";
import { RouteError, handleRouteError, ok } from "@/server/api/response";
import { requireApiUser } from "@/server/auth/session";
import {
  parseUpdateDocumentReadStateInput,
  updateDocumentReadState,
} from "@/server/modules/documents/document.service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    await requireApiUser();
    const { id } = await context.params;
    const body = parseUpdateDocumentReadStateInput(
      await readJsonBodyOrThrow(request, "Document read-state payload must be valid JSON."),
    );
    const data = await updateDocumentReadState(id, body);

    if (!data) {
      throw new RouteError("DOCUMENT_NOT_FOUND", 404, "Document was not found.");
    }

    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
