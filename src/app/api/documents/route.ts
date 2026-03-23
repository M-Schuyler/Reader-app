import type { NextRequest } from "next/server";
import { handleRouteError, ok } from "@/server/api/response";
import { requireApiUser } from "@/server/auth/session";
import { getDocuments, parseDocumentListQuery } from "@/server/modules/documents/document.service";

export async function GET(request: NextRequest) {
  try {
    await requireApiUser();
    const data = await getDocuments(parseDocumentListQuery(request.nextUrl.searchParams));
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}
