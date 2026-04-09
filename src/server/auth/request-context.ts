import { sanitizeCallbackUrl } from "@/server/auth/access";

export const AUTH_REQUEST_PATHNAME_HEADER = "x-reader-auth-pathname";
export const AUTH_REQUEST_SEARCH_HEADER = "x-reader-auth-search";

type AuthRequestContext = {
  pathname: string | null | undefined;
  search: string | null | undefined;
};

export function withAuthRequestContext(headers: Headers, input: { pathname: string; search: string }) {
  const requestHeaders = new Headers(headers);
  requestHeaders.set(AUTH_REQUEST_PATHNAME_HEADER, input.pathname);
  requestHeaders.set(AUTH_REQUEST_SEARCH_HEADER, input.search);
  return requestHeaders;
}

export function buildPageLoginRedirectPath(input: AuthRequestContext) {
  const pathname = normalizePathname(input.pathname);
  if (!pathname || pathname === "/login") {
    return "/login";
  }

  const callbackUrl = sanitizeCallbackUrl(`${pathname}${normalizeSearch(input.search)}`);
  const loginSearchParams = new URLSearchParams();
  loginSearchParams.set("callbackUrl", callbackUrl);

  return `/login?${loginSearchParams.toString()}`;
}

function normalizePathname(pathname: string | null | undefined) {
  if (!pathname || !pathname.startsWith("/") || pathname.startsWith("//")) {
    return null;
  }

  return pathname;
}

function normalizeSearch(search: string | null | undefined) {
  if (!search) {
    return "";
  }

  return search.startsWith("?") ? search : `?${search}`;
}
