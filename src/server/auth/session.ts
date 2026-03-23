import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { RouteError } from "@/server/api/response";
import { getAuthenticatedUserFromSession } from "./access";

export async function getAuthenticatedUser() {
  return getAuthenticatedUserFromSession(await auth());
}

export async function requirePageUser() {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login");
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
