import { timingSafeEqual } from "node:crypto";
import { RouteError } from "@/server/api/response";

const BEARER_PREFIX = "Bearer ";

export function requireInternalApiAccess(request: Request) {
  const configuredSecrets = [process.env.INTERNAL_API_SECRET?.trim(), process.env.CRON_SECRET?.trim()].filter(
    (value): value is string => Boolean(value),
  );

  if (configuredSecrets.length === 0) {
    throw new RouteError(
      "INTERNAL_API_SECRET_NOT_CONFIGURED",
      500,
      "Neither INTERNAL_API_SECRET nor CRON_SECRET is configured.",
    );
  }

  const token = extractBearerToken(request.headers.get("authorization"));
  if (!token || !configuredSecrets.some((secret) => safeEqual(token, secret))) {
    throw new RouteError("UNAUTHORIZED", 401, "Internal API authentication failed.");
  }
}

function extractBearerToken(value: string | null) {
  if (!value?.startsWith(BEARER_PREFIX)) {
    return null;
  }

  const token = value.slice(BEARER_PREFIX.length).trim();
  return token ? token : null;
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}
