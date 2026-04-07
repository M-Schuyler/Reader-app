import { handleRouteError, ok, RouteError } from "@/server/api/response";
import { requireInternalApiAccess } from "@/server/auth/internal";
import { requireApiUser } from "@/server/auth/session";
import { sweepPendingDocumentAiSummaryJobs } from "@/server/modules/documents/document-ai-summary-jobs.service";

export async function POST(request: Request) {
  return handleSweepRequest(request);
}

export async function GET(request: Request) {
  return handleSweepRequest(request);
}

async function handleSweepRequest(request: Request) {
  try {
    await requireSummarySweepAccess(request);

    const searchParams = new URL(request.url).searchParams;
    const data = await sweepPendingDocumentAiSummaryJobs({
      limit: parsePositiveInteger(searchParams.get("limit"), "limit"),
      maxRuns: parsePositiveInteger(searchParams.get("maxRuns"), "maxRuns"),
      maxRuntimeMs: parsePositiveInteger(searchParams.get("maxRuntimeMs"), "maxRuntimeMs"),
    });

    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}

async function requireSummarySweepAccess(request: Request) {
  if (request.headers.get("authorization")) {
    requireInternalApiAccess(request);
    return;
  }

  await requireApiUser();
}

function parsePositiveInteger(value: string | null, name: "limit" | "maxRuns" | "maxRuntimeMs") {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed < 1) {
    throw new RouteError("INVALID_QUERY", 400, `"${name}" must be a positive integer.`);
  }

  return parsed;
}
