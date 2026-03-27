import { RouteError } from "@/server/api/response";

export function parseBackfillRun(value: string | null) {
  if (!value) {
    return false;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new RouteError("INVALID_QUERY", 400, '"run" must be "true" or "false" when provided.');
}
