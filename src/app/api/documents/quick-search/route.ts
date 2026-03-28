import type { NextRequest } from "next/server";
import { handleRouteError, ok } from "@/server/api/response";
import { requireApiUser } from "@/server/auth/session";
import { getQuickSearchResults } from "@/server/modules/documents/document.service";

export async function GET(request: NextRequest) {
  try {
    await requireApiUser();
    const q = request.nextUrl.searchParams.get("q") ?? "";
    const data = await getQuickSearchResults(q);
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
