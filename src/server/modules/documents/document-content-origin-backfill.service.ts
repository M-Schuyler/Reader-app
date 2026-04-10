import { deriveContentOriginMetadata, syncWechatSubsourceFromContentOrigin } from "@/lib/documents/content-origin";
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
        const contentOriginLabel = contentOrigin.key?.startsWith("wechat:biz:")
          ? await resolveWechatContentOriginLabel(
              {
                isWechat: true,
                key: contentOrigin.key,
                label: contentOrigin.label,
              },
              metadata.wechatAccountName,
              upsertWechatSubsource,
            )
          : contentOrigin.label ?? "未识别公众号";

        await persistOrigin(candidate.id, {
          contentOriginKey: contentOrigin.key ?? "wechat:unknown",
          contentOriginLabel,
          ...(candidate.author ? {} : metadata.author ? { author: metadata.author } : {}),
        });
        updated += 1;
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
      }
    }

    if (lastError) {
      if (candidateBizOrigin && candidate.contentOriginKey !== candidateBizOrigin.key) {
        const contentOriginLabel = await resolveWechatContentOriginLabel(candidateBizOrigin, null, upsertWechatSubsource);
        await persistOrigin(candidate.id, {
          contentOriginKey: candidateBizOrigin.key,
          contentOriginLabel,
        });
        updated += 1;
      } else if (candidate.contentOriginKey === null) {
        await persistOrigin(candidate.id, {
          contentOriginKey: "wechat:unknown",
          contentOriginLabel: "未识别公众号",
        });
        updated += 1;
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

async function resolveWechatContentOriginLabel(
  origin: WechatBizOrigin,
  wechatAccountName: string | null,
  upsertWechatSubsource: typeof defaultUpsertWechatSubsource,
) {
  const subsource = (await syncWechatSubsourceFromContentOrigin(
    {
      key: origin.key,
      label: origin.label,
      isWechat: true,
    },
    {
      wechatAccountName,
    },
    upsertWechatSubsource,
  )) as { displayName: string } | null;

  return subsource?.displayName ?? origin.label ?? "未识别公众号";
}
