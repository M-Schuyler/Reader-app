import { sanitizeCallbackUrl } from "@/server/auth/access";

const LOGIN_PATH = "/login";

type AuthMiddlewareDecisionInput = {
  pathname: string;
  search: string;
  origin: string;
  isAuthenticated: boolean;
  nodeEnv: string | undefined;
};

export type AuthMiddlewareDecision =
  | {
      type: "next";
    }
  | {
      type: "redirect";
      location: string;
    }
  | {
      type: "unauthorized";
    };

export function getAuthMiddlewareDecision(input: AuthMiddlewareDecisionInput): AuthMiddlewareDecision {
  if (input.nodeEnv !== "production") {
    return { type: "next" };
  }

  const isInternalApiPath = input.pathname.startsWith("/api/internal/");

  if (input.pathname === LOGIN_PATH) {
    if (!input.isAuthenticated) {
      return { type: "next" };
    }

    const callbackUrl = sanitizeCallbackUrl(new URLSearchParams(input.search).get("callbackUrl"));
    return {
      type: "redirect",
      location: new URL(callbackUrl, input.origin).toString(),
    };
  }

  if (input.isAuthenticated) {
    return { type: "next" };
  }

  if (isInternalApiPath) {
    return { type: "next" };
  }

  if (input.pathname.startsWith("/api/")) {
    return { type: "unauthorized" };
  }

  const loginUrl = new URL(LOGIN_PATH, input.origin);
  loginUrl.searchParams.set("callbackUrl", `${input.pathname}${input.search}`);

  return {
    type: "redirect",
    location: loginUrl.toString(),
  };
}
