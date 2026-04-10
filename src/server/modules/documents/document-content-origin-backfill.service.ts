import { deriveContentOriginMetadata } from "@/lib/documents/content-origin";
import { extractWebPageMetadata, type ExtractedWebPageMetadata } from "@/server/extractors/web/extract-web-page";
import { listWechatContentOriginBackfillCandidates, updateDocumentContentOrigin } from "./document.repository";
import { upsertWechatSubsource as defaultUpsertWechatSubsource } from "./wechat-subsource.service";

const DEFAULT_BACKFILL_LIMIT = 20;
const MAX_BACKFILL_LIMIT = 50;
const WECHAT_FETCH_MAX_ATTEMPTS = 4;

type WechatContentOriginBackfillCandidate = {
  id: string;
  author: string | null;
  sourceUrl: string | null;
  canonicalUrl: string | null;
  contentOriginKey: string | null;
  contentOriginLabel: string | null;
};

type WechatBizOrigin = {
  isWechat: true;
  key: string;
  label: string | null;
};

type BackfillWechatContentOriginsDeps = {
  listCandidates?: (
    limit: number,
  ) => Promise<{
    items: WechatContentOriginBackfillCandidate[];
    hasMore: boolean;
  }>;
  fetchMetadata?: (url: string) => Promise<ExtractedWebPageMetadata>;
  updateDocumentOrigin?: (
    documentId: string,
    input: {
      contentOriginKey: string;
      contentOriginLabel: string;
      author?: string | null;
    },
  ) => Promise<unknown>;
  upsertWechatSubsource?: typeof defaultUpsertWechatSubsource;
};

export type BackfillWechatContentOriginsResponse = {
  scanned: number;
  updated: number;
  failed: number;
  hasMore: boolean;
};

export async function backfillWechatContentOrigins(
  limitInput?: number,
  deps: BackfillWechatContentOriginsDeps = {},
): Promise<BackfillWechatContentOriginsResponse> {
  const limit = normalizeBackfillLimit(limitInput);
  const listCandidates = deps.listCandidates ?? listWechatContentOriginBackfillCandidates;
  const fetchMetadata = deps.fetchMetadata ?? extractWebPageMetadata;
  const persistOrigin = deps.updateDocumentOrigin ?? updateDocumentContentOrigin;
  const upsertWechatSubsource = deps.upsertWechatSubsource ?? defaultUpsertWechatSubsource;
  const { items, hasMore } = await listCandidates(limit);

  let updated = 0;
  let failed = 0;

  for (const candidate of items) {
    const targetUrl = candidate.canonicalUrl ?? candidate.sourceUrl;
    const candidateBizOrigin = resolveWechatBizOrigin(candidate);
    let persistedContentOriginKey = candidate.contentOriginKey;
    let persistedContentOriginLabel = candidate.contentOriginLabel;

    if (candidateBizOrigin) {
      const repairedLabel = await ensureWechatBizDisplayName(
        readWeChatBizFromOriginKey(candidateBizOrigin.key),
        normalizeWechatDisplayName(candidate.contentOriginLabel),
        upsertWechatSubsource,
      );

      if (persistedContentOriginKey !== candidateBizOrigin.key || persistedContentOriginLabel !== repairedLabel) {
        await persistOrigin(candidate.id, {
          contentOriginKey: candidateBizOrigin.key,
          contentOriginLabel: repairedLabel,
        });
        persistedContentOriginKey = candidateBizOrigin.key;
        persistedContentOriginLabel = repairedLabel;
        updated += 1;
      }
    }

    if (!targetUrl) {
      if (candidate.contentOriginKey === null) {
        await persistOrigin(candidate.id, {
          contentOriginKey: "wechat:unknown",
          contentOriginLabel: "未识别公众号",
        });
      }
      failed += 1;
      continue;
    }

    let lastError: unknown = null;

    for (let attempt = 1; attempt <= WECHAT_FETCH_MAX_ATTEMPTS; attempt += 1) {
      try {
        const metadata = await fetchMetadata(targetUrl);
        const contentOrigin = candidateBizOrigin ?? deriveContentOriginMetadata({
          author: metadata.author,
          canonicalUrl: metadata.canonicalUrl,
          finalUrl: metadata.finalUrl,
          sourceUrl: targetUrl,
          wechatAccountName: metadata.wechatAccountName,
        });

        if (contentOrigin.key?.startsWith("wechat:biz:")) {
          const promotedDisplayName = normalizeWechatDisplayName(metadata.wechatAccountName);
          const contentOriginLabel = await ensureWechatBizDisplayName(
            readWeChatBizFromOriginKey(contentOrigin.key),
            promotedDisplayName,
            upsertWechatSubsource,
          );
          const nextAuthor = candidate.author ? null : metadata.author ?? null;
          const hasOriginChange =
            persistedContentOriginKey !== contentOrigin.key || persistedContentOriginLabel !== contentOriginLabel;
          const hasAuthorChange = nextAuthor !== null;

          if (hasOriginChange || hasAuthorChange) {
            await persistOrigin(candidate.id, {
              contentOriginKey: contentOrigin.key,
              contentOriginLabel,
              ...(hasAuthorChange ? { author: nextAuthor } : {}),
            });
            persistedContentOriginKey = contentOrigin.key;
            persistedContentOriginLabel = contentOriginLabel;
            updated += 1;
          }
        } else {
          const nextAuthor = candidate.author ? null : metadata.author ?? null;
          const contentOriginKey = contentOrigin.key ?? "wechat:unknown";
          const contentOriginLabel = contentOrigin.label ?? "未识别公众号";
          const hasOriginChange =
            persistedContentOriginKey !== contentOriginKey || persistedContentOriginLabel !== contentOriginLabel;
          const hasAuthorChange = nextAuthor !== null;

          if (hasOriginChange || hasAuthorChange) {
            await persistOrigin(candidate.id, {
              contentOriginKey,
              contentOriginLabel,
              ...(hasAuthorChange ? { author: nextAuthor } : {}),
            });
            persistedContentOriginKey = contentOriginKey;
            persistedContentOriginLabel = contentOriginLabel;
            updated += 1;
          }
        }
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
      }
    }

    if (lastError) {
      if (candidateBizOrigin) {
        failed += 1;
        continue;
      }

      if (candidate.contentOriginKey === null) {
        await persistOrigin(candidate.id, {
          contentOriginKey: "wechat:unknown",
          contentOriginLabel: "未识别公众号",
        });
      }
      failed += 1;
    }
  }

  return {
    scanned: items.length,
    updated,
    failed,
    hasMore,
  };
}

function normalizeBackfillLimit(value: number | null | undefined) {
  if (!Number.isFinite(value)) {
    return DEFAULT_BACKFILL_LIMIT;
  }

  const normalized = Math.trunc(value as number);
  if (normalized < 1) {
    return DEFAULT_BACKFILL_LIMIT;
  }

  return Math.min(normalized, MAX_BACKFILL_LIMIT);
}

function resolveWechatBizOrigin(candidate: Pick<WechatContentOriginBackfillCandidate, "canonicalUrl" | "sourceUrl">): WechatBizOrigin | null {
  return (
    resolveWechatBizOriginFromUrl(candidate.canonicalUrl) ??
    resolveWechatBizOriginFromUrl(candidate.sourceUrl) ??
    null
  );
}

function resolveWechatBizOriginFromUrl(url: string | null): WechatBizOrigin | null {
  if (!url) {
    return null;
  }

  const origin = deriveContentOriginMetadata({
    canonicalUrl: url,
    sourceUrl: url,
  });

  return origin.key?.startsWith("wechat:biz:")
    ? {
        isWechat: true,
        key: origin.key,
        label: origin.label,
      }
    : null;
}

async function ensureWechatBizDisplayName(
  biz: string | null,
  displayName: string | null,
  upsertWechatSubsource: typeof defaultUpsertWechatSubsource,
) {
  if (!biz) {
    return displayName ?? "未识别公众号";
  }

  const subsource = await upsertWechatSubsource({
    biz,
    displayName,
  });

  return subsource.displayName;
}

function normalizeWechatDisplayName(value: string | null) {
  const normalized = value?.trim() ?? null;
  if (!normalized || normalized === "未识别公众号") {
    return null;
  }

  return normalized;
}

function readWeChatBizFromOriginKey(value: string) {
  return value.startsWith("wechat:biz:") ? value.slice("wechat:biz:".length) : null;
}
