import { handleRouteError, ok } from "@/server/api/response";
import { readJsonBodyOrThrow } from "@/server/api/request";
import { requireApiUser } from "@/server/auth/session";
import { importCuboxBatch, parseCuboxImportBatchInput } from "@/server/modules/imports/cubox";

export async function POST(request: Request) {
  try {
    await requireApiUser();
    const body = await readJsonBodyOrThrow(request);
    const input = parseCuboxImportBatchInput(body);
    const data = await importCuboxBatch(input);
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
