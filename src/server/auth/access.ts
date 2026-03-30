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
  return getAllowedEmails().size > 0 || Boolean(getDevLocalAuthUser());
}

export function isAllowedEmail(email: string | null | undefined) {
  const normalizedEmail = normalizeEmail(email);
  const devLocalAuthUser = getDevLocalAuthUser();

  if (devLocalAuthUser && normalizedEmail === devLocalAuthUser.email) {
    return true;
  }

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
  if (getDevLocalAuthUser()) {
    return true;
  }

  return isAllowedEmail(session?.user?.email);
}

export function getAuthenticatedUserFromSession(session: Session | null | undefined): AuthenticatedUser | null {
  const devLocalAuthUser = getDevLocalAuthUser();
  if (devLocalAuthUser) {
    return devLocalAuthUser;
  }

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

export function getDevLocalAuthUser(): AuthenticatedUser | null {
  if (process.env.NODE_ENV === "production") {
    return null;
  }

  const email = normalizeEmail(process.env.DEV_LOCAL_AUTH_EMAIL);
  if (!email) {
    return null;
  }

  return {
    email,
    name: "Local Dev",
    image: null,
  };
}

function normalizeEmail(value: string | null | undefined) {
  const trimmed = value?.trim().toLowerCase();
  return trimmed ? trimmed : null;
}
