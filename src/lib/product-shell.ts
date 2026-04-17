import { ReadState } from "@prisma/client";
import type { DocumentListQuery } from "@/server/modules/documents/document.types";

export type MainNavItem = {
  href: string;
  label: string;
  isActive: boolean;
};

export type PrimaryNavItemId = "search" | "sources" | "reading" | "highlights";

export type PrimaryNavItem = {
  id: PrimaryNavItemId;
  label: string;
  href: string | null;
  kind: "action" | "link";
  isActive: boolean;
};

export type ReadingViewId = "queue" | "starred" | "archive";

type ReadingViewState = Pick<DocumentListQuery, "isFavorite" | "readState">;

const MAIN_NAV_ITEMS = [
  { href: "/sources", label: "来源库" },
  { href: "/reading", label: "Reading" },
  { href: "/highlights", label: "高亮" },
] as const;

const PRIMARY_NAV_DEFS = [
  { id: "search", label: "搜索", href: null, kind: "action" as const },
  { id: "sources", label: "来源库", href: "/sources", kind: "link" as const },
  { id: "reading", label: "Reading", href: "/reading", kind: "link" as const },
  { id: "highlights", label: "高亮", href: "/highlights", kind: "link" as const },
] as const;

export function getMainNavItems(pathname: string): MainNavItem[] {
  return MAIN_NAV_ITEMS.map((item) => ({
    ...item,
    isActive: isNavItemActive(pathname, item.href),
  }));
}

export function getPrimaryNavItems(input: { pathname: string; searchOpen: boolean }): PrimaryNavItem[] {
  return PRIMARY_NAV_DEFS.map((item) => ({
    ...item,
    isActive: input.searchOpen ? item.id === "search" : item.id !== "search" && item.href !== null && isNavItemActive(input.pathname, item.href),
  }));
}

export function resolveReadingView(state: Partial<ReadingViewState>): ReadingViewId {
  if (state.isFavorite) {
    return "starred";
  }

  if (state.readState === ReadState.READ) {
    return "archive";
  }

  return "queue";
}

export function buildReadingViewHref(view: ReadingViewId, baseParams: URLSearchParams) {
  const params = new URLSearchParams(baseParams);

  params.delete("page");
  params.delete("isFavorite");
  params.delete("readState");

  switch (view) {
    case "starred":
      params.set("isFavorite", "true");
      break;
    case "archive":
      params.set("readState", ReadState.READ);
      break;
    case "queue":
    default:
      break;
  }

  const query = params.toString();
  return query ? `/reading?${query}` : "/reading";
}

function isNavItemActive(pathname: string, href: string) {
  if (href === "/reading") {
    return pathname === "/reading" || pathname.startsWith("/reading/");
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}
