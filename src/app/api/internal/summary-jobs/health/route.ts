import { handleRouteError, ok } from "@/server/api/response";
import { requireInternalApiAccess } from "@/server/auth/internal";
import { requireApiUser } from "@/server/auth/session";
import { getSummaryRuntimeIssues } from "@/server/modules/documents/document-ai-summary-jobs.service";

export async function GET(request: Request) {
  try {
    await requireSummaryHealthAccess(request);

    const issues = getSummaryRuntimeIssues();
    return ok({
      ok: issues.length === 0,
      issues,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

async function requireSummaryHealthAccess(request: Request) {
  if (request.headers.get("authorization")) {
    requireInternalApiAccess(request);
    return;
  }

  await requireApiUser();
}
