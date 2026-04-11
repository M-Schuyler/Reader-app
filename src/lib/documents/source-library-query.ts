import { parseDocumentListQuery } from "@/server/modules/documents/document.service";
import type { DocumentListQuery, GetDocumentsResponseData } from "@/server/modules/documents/document.types";

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

export function buildSourceLibraryBrowseHref(
  basePath: string,
  query: Pick<DocumentListQuery, "q" | "sort" | "surface" | "tag" | "type"> &
    Partial<Pick<DocumentListQuery, "origin" | "page" | "pageSize">>,
) {
  const params = new URLSearchParams();

  if (query.q) {
    params.set("q", query.q);
  }

  if (query.type) {
    params.set("type", query.type);
  }

  if (query.tag) {
    params.set("tag", query.tag);
  }

  if (query.origin) {
    params.set("origin", query.origin);
  }

  if (query.sort === "earliest") {
    params.set("sort", query.sort);
  }

  const nextQuery = params.toString();
  return nextQuery ? `${basePath}?${nextQuery}` : basePath;
}

export function buildSourceContextChips(
  filters: GetDocumentsResponseData["filters"],
  contentOriginOptions: NonNullable<GetDocumentsResponseData["contentOrigin"]>["options"] = [],
  options: { sortContext?: "sourceIndex" | "documentList" } = {},
) {
  const sortContext = options.sortContext ?? "documentList";
  const chips: string[] = [];

  if (filters.q) {
    chips.push(`搜索 “${filters.q}”`);
  }

  if (filters.type) {
    chips.push(`类型 ${formatDocumentType(filters.type)}`);
  }

  if (filters.origin) {
    const activeOrigin = contentOriginOptions.find((option) => option.value === filters.origin);
    chips.push(`创作来源 ${activeOrigin?.label ?? filters.origin}`);
  }

  if (filters.tag) {
    chips.push(`标签 ${filters.tag}`);
  }

  if (filters.sort === "earliest") {
    chips.push(sortContext === "sourceIndex" ? "较早有新文档优先" : "最早收进来优先");
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
