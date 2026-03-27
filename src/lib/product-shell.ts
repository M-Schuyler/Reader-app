import { ReadState } from "@prisma/client";
import type { DocumentListQuery } from "@/server/modules/documents/document.types";

export type MainNavItem = {
  href: string;
  label: string;
  isActive: boolean;
};

export type LibraryViewId = "inbox" | "later" | "starred" | "archive";

type LibraryViewState = Pick<DocumentListQuery, "isFavorite" | "isLater" | "readState">;

const MAIN_NAV_ITEMS = [
  { href: "/library", label: "文档库" },
  { href: "/highlights", label: "高亮" },
  { href: "/export", label: "导出" },
] as const;

export function getMainNavItems(pathname: string): MainNavItem[] {
  return MAIN_NAV_ITEMS.map((item) => ({
    ...item,
    isActive: isNavItemActive(pathname, item.href),
  }));
}

export function resolveLibraryView(state: Partial<LibraryViewState>): LibraryViewId {
  if (state.isLater) {
    return "later";
  }

  if (state.isFavorite) {
    return "starred";
  }

  if (state.readState === ReadState.READ) {
    return "archive";
  }

  return "inbox";
}

export function buildLibraryViewHref(view: LibraryViewId, baseParams: URLSearchParams) {
  const params = new URLSearchParams(baseParams);

  params.delete("page");
  params.delete("isLater");
  params.delete("isFavorite");
  params.delete("readState");

  switch (view) {
    case "later":
      params.set("isLater", "true");
      break;
    case "starred":
      params.set("isFavorite", "true");
      break;
    case "archive":
      params.set("readState", ReadState.READ);
      break;
    case "inbox":
    default:
      break;
  }

  const query = params.toString();
  return query ? `/library?${query}` : "/library";
}

function isNavItemActive(pathname: string, href: string) {
  if (href === "/library") {
    return pathname === "/library" || pathname.startsWith("/documents/");
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}
