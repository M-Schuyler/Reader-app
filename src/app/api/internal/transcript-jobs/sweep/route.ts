import { handleRouteError, ok } from "@/server/api/response";
import { requireInternalApiAccess } from "@/server/auth/internal";
import { sweepTranscriptQueueForReader } from "@/server/modules/documents/document.service";

export async function POST(request: Request) {
  try {
    requireInternalApiAccess(request);
    return ok(await sweepTranscriptQueueForReader());
  } catch (error) {
    return handleRouteError(error);
  }
}
