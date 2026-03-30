import { handleRouteError, ok } from "@/server/api/response";
import { requireInternalApiAccess } from "@/server/auth/internal";
import { requireApiUser } from "@/server/auth/session";
import { parseSourceSyncLimit, runScheduledSourceSyncs } from "@/server/modules/sources/source.service";

export async function GET(request: Request) {
  return handleRunRequest(request);
}

export async function POST(request: Request) {
  return handleRunRequest(request);
}

async function handleRunRequest(request: Request) {
  try {
    await requireSourceSyncAccess(request);
    const limit = parseSourceSyncLimit(new URL(request.url).searchParams.get("limit"));
    const data = await runScheduledSourceSyncs(limit);
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}

async function requireSourceSyncAccess(request: Request) {
  if (request.headers.get("authorization")) {
    requireInternalApiAccess(request);
    return;
  }

  await requireApiUser();
}
