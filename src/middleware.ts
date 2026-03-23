import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const REALM = "Reader App";

export function middleware(request: NextRequest) {
  const username = process.env.APP_BASIC_AUTH_USERNAME;
  const password = process.env.APP_BASIC_AUTH_PASSWORD;

  if (!username || !password) {
    return NextResponse.next();
  }

  const authorization = request.headers.get("authorization");
  if (authorization) {
    const [scheme, credentials] = authorization.split(" ");

    if (scheme === "Basic" && credentials) {
      const decoded = decodeBase64(credentials);
      const separatorIndex = decoded.indexOf(":");

      if (separatorIndex >= 0) {
        const providedUsername = decoded.slice(0, separatorIndex);
        const providedPassword = decoded.slice(separatorIndex + 1);

        if (providedUsername === username && providedPassword === password) {
          return NextResponse.next();
        }
      }
    }
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": `Basic realm="${REALM}"`,
      "Cache-Control": "no-store",
    },
  });
}

function decodeBase64(value: string) {
  try {
    return atob(value);
  } catch {
    return "";
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
};

