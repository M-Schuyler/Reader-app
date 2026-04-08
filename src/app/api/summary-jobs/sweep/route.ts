import { handleRouteError, ok } from "@/server/api/response";
import { requireApiUser } from "@/server/auth/session";
import { sweepSummaryQueueForReader } from "@/server/modules/documents/document.service";

export async function POST() {
  try {
    await requireApiUser();
    return ok(await sweepSummaryQueueForReader());
  } catch (error) {
    return handleRouteError(error);
  }
}
