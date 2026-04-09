import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAllowedSession } from "@/server/auth/access";
import { getAuthMiddlewareDecision } from "@/server/auth/middleware-gate";
import { withAuthRequestContext } from "@/server/auth/request-context";

export default auth((request) => {
  const { nextUrl } = request;
  const pathname = nextUrl.pathname;
  const requestHeaders = withAuthRequestContext(request.headers, {
    pathname,
    search: nextUrl.search,
  });
  const isAuthenticated = isAllowedSession(request.auth);

  // This middleware runs in a different runtime than the page and route guards.
  // In local development, keeping auth redirects here creates split-brain behavior:
  // the server-side guards see DEV_LOCAL_AUTH_EMAIL, but middleware may not.
  // We accept the tradeoff of making middleware a no-op outside production so
  // local auth flows stay coherent. Production still enforces the redirect gate here.
  const decision = getAuthMiddlewareDecision({
    pathname,
    search: nextUrl.search,
    origin: nextUrl.origin,
    isAuthenticated,
    nodeEnv: process.env.NODE_ENV,
  });

  if (decision.type === "next") {
    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  if (decision.type === "unauthorized") {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Authentication required.",
        },
      },
      { status: 401 },
    );
  }

  return NextResponse.redirect(new URL(decision.location));
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|qa(?:/.*)?$).*)"],
};
