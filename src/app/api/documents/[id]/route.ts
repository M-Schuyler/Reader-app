import { RouteError, handleRouteError, ok } from "@/server/api/response";
import { requireApiUser } from "@/server/auth/session";
import { deleteDocument, getDocument } from "@/server/modules/documents/document.service";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, context: RouteContext) {
  try {
    await requireApiUser();
    const { id } = await context.params;
    const data = await getDocument(id);

    if (!data) {
      throw new RouteError("DOCUMENT_NOT_FOUND", 404, "Document was not found.");
    }

    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_: Request, context: RouteContext) {
  try {
    await requireApiUser();
    const { id } = await context.params;
    const data = await deleteDocument(id);

    if (!data) {
      throw new RouteError("DOCUMENT_NOT_FOUND", 404, "Document was not found.");
    }

    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
