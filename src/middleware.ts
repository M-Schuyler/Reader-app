import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAllowedSession, sanitizeCallbackUrl } from "@/server/auth/access";

const LOGIN_PATH = "/login";

export default auth((request) => {
  const { nextUrl } = request;
  const pathname = nextUrl.pathname;
  const isAuthenticated = isAllowedSession(request.auth);
  const isInternalApiPath = pathname.startsWith("/api/internal/");
  const isQaPath = pathname === "/qa" || pathname.startsWith("/qa/");
  const isQaFixtureApiPath =
    pathname === "/api/documents/qa-highlights-document/highlights" || pathname.startsWith("/api/highlights/qa-highlight-");
  const isQaRealDocumentApiPath =
    pathname.startsWith("/api/documents/qa-real-document--") && pathname.endsWith("/highlights");
  const isQaRealHighlightApiPath = pathname.startsWith("/api/highlights/qa-real-highlight--");

  if (isQaPath && process.env.NODE_ENV !== "production") {
    return NextResponse.next();
  }

  if ((isQaFixtureApiPath || isQaRealDocumentApiPath || isQaRealHighlightApiPath) && process.env.NODE_ENV !== "production") {
    return NextResponse.next();
  }

  if (pathname === LOGIN_PATH) {
    if (!isAuthenticated) {
      return NextResponse.next();
    }

    const callbackUrl = sanitizeCallbackUrl(nextUrl.searchParams.get("callbackUrl"));
    return NextResponse.redirect(new URL(callbackUrl, nextUrl.origin));
  }

  if (isAuthenticated) {
    return NextResponse.next();
  }

  if (isInternalApiPath) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
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

  const loginUrl = new URL(LOGIN_PATH, nextUrl.origin);
  loginUrl.searchParams.set("callbackUrl", `${pathname}${nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
});

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|qa(?:/.*)?$).*)"],
};
