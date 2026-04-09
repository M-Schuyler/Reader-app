import { handleRouteError, ok } from "@/server/api/response";
import { requireApiUser } from "@/server/auth/session";
import { getSummaryQueueStatusForReader } from "@/server/modules/documents/document.service";

export async function GET() {
  try {
    await requireApiUser();
    return ok(await getSummaryQueueStatusForReader());
  } catch (error) {
    return handleRouteError(error);
  }
}
