import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { auth } from "@/auth";
import { RouteError } from "@/server/api/response";
import { getAuthenticatedUserFromSession } from "./access";
import {
  AUTH_REQUEST_PATHNAME_HEADER,
  AUTH_REQUEST_SEARCH_HEADER,
  buildPageLoginRedirectPath,
} from "./request-context";

export async function getAuthenticatedUser() {
  return getAuthenticatedUserFromSession(await auth());
}

export async function requirePageUser() {
  const user = await getAuthenticatedUser();
  if (!user) {
    const requestHeaders = await headers();
    redirect(
      buildPageLoginRedirectPath({
        pathname: requestHeaders.get(AUTH_REQUEST_PATHNAME_HEADER),
        search: requestHeaders.get(AUTH_REQUEST_SEARCH_HEADER),
      }),
    );
  }

  return user;
}

export async function requireApiUser() {
  const user = await getAuthenticatedUser();
  if (!user) {
    throw new RouteError("UNAUTHORIZED", 401, "Authentication required.");
  }

  return user;
}
