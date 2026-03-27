import { handleRouteError, ok, RouteError } from "@/server/api/response";
import { requireInternalApiAccess } from "@/server/auth/internal";
import { requireApiUser } from "@/server/auth/session";
import {
  backfillAutomaticDocumentAiSummaryJobs,
  getSummaryRuntimeIssues,
  runPendingDocumentAiSummaryJobs,
} from "@/server/modules/documents/document-ai-summary-jobs.service";
import { parseBackfillRun } from "./params";

export async function POST(request: Request) {
  return handleBackfillRequest(request);
}

export async function GET(request: Request) {
  return handleBackfillRequest(request);
}

async function handleBackfillRequest(request: Request) {
  try {
    await requireSummaryBackfillAccess(request);

    const searchParams = new URL(request.url).searchParams;
    const limit = parseLimit(searchParams.get("limit"));
    const shouldRun = parseBackfillRun(searchParams.get("run"));
    const data = await backfillAutomaticDocumentAiSummaryJobs(limit);
    const runtimeIssues = getSummaryRuntimeIssues({ requireInternalApiSecret: false });
    const run = shouldRun && runtimeIssues.length === 0 ? await runPendingDocumentAiSummaryJobs(limit) : null;

    return ok({
      ...data,
      runtimeIssues,
      run,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

async function requireSummaryBackfillAccess(request: Request) {
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
