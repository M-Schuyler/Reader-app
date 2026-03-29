import { handleRouteError, ok } from "@/server/api/response";
import { readJsonBodyOrThrow } from "@/server/api/request";
import { requireApiUser } from "@/server/auth/session";
import { parseUpdateSourceAliasInput, updateSourceAliasName } from "@/server/modules/documents/document.service";

export async function PUT(request: Request) {
  try {
    await requireApiUser();
    const body = await readJsonBodyOrThrow(request);
    const input = parseUpdateSourceAliasInput(body);
    const data = await updateSourceAliasName(input);

    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
