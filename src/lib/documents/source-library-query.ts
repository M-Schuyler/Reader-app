import { parseDocumentListQuery } from "@/server/modules/documents/document.service";
import type { GetDocumentsResponseData } from "@/server/modules/documents/document.types";

export const parseSourceLibraryQuery = parseDocumentListQuery;

type SourceSearchParamsInput = Promise<Record<string, string | string[] | undefined>> | undefined;

export async function resolveSourceSearchParams(input: SourceSearchParamsInput): Promise<URLSearchParams> {
  const resolved = await (input ?? Promise.resolve({}));
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(resolved)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string") {
          searchParams.append(key, item);
        }
      }
      continue;
    }

    if (typeof value === "string") {
      searchParams.set(key, value);
    }
  }

  return searchParams;
}

export function buildSourceLibraryClearHref(basePath: string, filters: GetDocumentsResponseData["filters"]) {
  return filters.q ? `${basePath}?q=${encodeURIComponent(filters.q)}` : basePath;
}

export function buildSourceContextChips(filters: GetDocumentsResponseData["filters"]) {
  const chips: string[] = [];

  if (filters.q) {
    chips.push(`搜索 “${filters.q}”`);
  }

  if (filters.type) {
    chips.push(`类型 ${formatDocumentType(filters.type)}`);
  }

  if (filters.sort === "earliest") {
    chips.push("最早收进来优先");
  }

  return chips;
}

function formatDocumentType(value: string) {
  switch (value) {
    case "WEB_PAGE":
      return "网页";
    case "RSS_ITEM":
      return "RSS";
    case "PDF":
      return "PDF";
    default:
      return value;
  }
}
