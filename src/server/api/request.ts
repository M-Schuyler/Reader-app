import { RouteError } from "@/server/api/response";

export async function readJsonBodyOrThrow(
  request: Request,
  message = "Request body must be valid JSON.",
) {
  try {
    return await request.json();
  } catch {
    throw new RouteError("INVALID_BODY", 400, message);
  }
}
