import { handleRouteError, ok, RouteError } from "@/server/api/response";
import { requireInternalApiAccess } from "@/server/auth/internal";
import { requireApiUser } from "@/server/auth/session";
import { runPendingDocumentAiSummaryJobs } from "@/server/modules/documents/document-ai-summary-jobs.service";

export async function POST(request: Request) {
  return handleRunRequest(request);
}

export async function GET(request: Request) {
  return handleRunRequest(request);
}

async function handleRunRequest(request: Request) {
  try {
    await requireSummaryRunAccess(request);

    const limit = parseLimit(new URL(request.url).searchParams.get("limit"));
    const data = await runPendingDocumentAiSummaryJobs(limit);
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}

async function requireSummaryRunAccess(request: Request) {
  if (request.headers.get("authorization")) {
    requireInternalApiAccess(request);
    return;
  }

  await requireApiUser();
}

function parseLimit(value: string | null) {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    throw new RouteError("INVALID_QUERY", 400, '"limit" must be a positive integer.');
  }

  return parsed;
}
