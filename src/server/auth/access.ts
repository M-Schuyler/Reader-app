import type { Session } from "next-auth";

export type AuthenticatedUser = {
  email: string;
  name: string | null;
  image: string | null;
};

export function getAllowedEmails() {
  return new Set(
    (process.env.ALLOWED_EMAILS ?? "")
      .split(",")
      .map((value) => normalizeEmail(value))
      .filter((value): value is string => Boolean(value)),
  );
}

export function hasAllowedEmailsConfigured() {
  return getAllowedEmails().size > 0;
}

export function isAllowedEmail(email: string | null | undefined) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return false;
  }

  const allowedEmails = getAllowedEmails();
  if (allowedEmails.size === 0) {
    return false;
  }

  return allowedEmails.has(normalizedEmail);
}

export function isAllowedSession(session: Session | null | undefined) {
  return isAllowedEmail(session?.user?.email);
}

export function getAuthenticatedUserFromSession(session: Session | null | undefined): AuthenticatedUser | null {
  const normalizedEmail = normalizeEmail(session?.user?.email);
  if (!normalizedEmail || !isAllowedEmail(normalizedEmail)) {
    return null;
  }

  return {
    email: normalizedEmail,
    name: session?.user?.name ?? null,
    image: session?.user?.image ?? null,
  };
}

export function sanitizeCallbackUrl(value: string | null | undefined) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/sources";
  }

  return value;
}

function normalizeEmail(value: string | null | undefined) {
  const trimmed = value?.trim().toLowerCase();
  return trimmed ? trimmed : null;
}
