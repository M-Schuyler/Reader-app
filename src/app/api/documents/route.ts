import type { NextRequest } from "next/server";
import { handleRouteError, ok } from "@/server/api/response";
import { getDocuments, parseDocumentListQuery } from "@/server/modules/documents/document.service";

export async function GET(request: NextRequest) {
  try {
    const data = await getDocuments(parseDocumentListQuery(request.nextUrl.searchParams));
    return ok(data);
  } catch (error) {
    return handleRouteError(error);
  }
}

