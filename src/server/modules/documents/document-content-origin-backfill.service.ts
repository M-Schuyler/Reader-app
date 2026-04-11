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
    let persistedContentOriginKey = candidate.contentOriginKey;
    let persistedContentOriginLabel = candidate.contentOriginLabel;
    let candidateBizRegistryDisplayName: string | null = null;

    if (candidateBizOrigin) {
      candidateBizRegistryDisplayName = await syncWechatBizDisplayName(
        candidateBizOrigin.key,
        null,
        upsertWechatSubsource,
      );

      const shouldRepairDocumentLabel =
        candidate.contentOriginKey !== candidateBizOrigin.key || !hasNonEmptyLabel(candidate.contentOriginLabel);

      if (shouldRepairDocumentLabel) {
        await persistOrigin(candidate.id, {
          contentOriginKey: candidateBizOrigin.key,
          contentOriginLabel: chooseWechatDocumentLabel({
            currentKey: persistedContentOriginKey,
            currentLabel: persistedContentOriginLabel,
            bizKey: candidateBizOrigin.key,
            registryDisplayName: candidateBizRegistryDisplayName,
            trustedAccountName: null,
          }),
        });
        persistedContentOriginKey = candidateBizOrigin.key;
        persistedContentOriginLabel = chooseWechatDocumentLabel({
          currentKey: candidateBizOrigin.key,
          currentLabel: persistedContentOriginLabel,
          bizKey: candidateBizOrigin.key,
          registryDisplayName: candidateBizRegistryDisplayName,
          trustedAccountName: null,
        });
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
          const nextAuthor = candidate.author ? null : metadata.author ?? null;
          const registryDisplayName =
            metadata.wechatAccountName !== null && typeof metadata.wechatAccountName !== "undefined"
              ? await syncWechatBizDisplayName(contentOrigin.key, metadata.wechatAccountName, upsertWechatSubsource)
              : candidateBizOrigin
                ? candidateBizRegistryDisplayName ?? "未识别公众号"
                : await syncWechatBizDisplayName(contentOrigin.key, null, upsertWechatSubsource);
          const nextDocumentLabel = chooseWechatDocumentLabel({
            currentKey: persistedContentOriginKey,
            currentLabel: persistedContentOriginLabel,
            bizKey: contentOrigin.key,
            registryDisplayName,
            trustedAccountName: metadata.wechatAccountName ?? null,
          });
          const hasOriginChange =
            persistedContentOriginKey !== contentOrigin.key || persistedContentOriginLabel !== nextDocumentLabel;
          const hasAuthorChange = nextAuthor !== null;

          if (hasOriginChange || hasAuthorChange) {
            await persistOrigin(candidate.id, {
              contentOriginKey: contentOrigin.key,
              contentOriginLabel: nextDocumentLabel,
              ...(hasAuthorChange ? { author: nextAuthor } : {}),
            });
            persistedContentOriginKey = contentOrigin.key;
            persistedContentOriginLabel = nextDocumentLabel;
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

async function syncWechatBizDisplayName(
  bizKey: string,
  trustedAccountName: string | null,
  upsertWechatSubsource: typeof defaultUpsertWechatSubsource,
) {
  const subsource = (await syncWechatSubsourceFromContentOrigin(
    {
      isWechat: true,
      key: bizKey,
      label: null,
    },
    {
      wechatAccountName: trustedAccountName,
    },
    upsertWechatSubsource,
  )) as { displayName: string } | null;

  return subsource?.displayName ?? "未识别公众号";
}

function chooseWechatDocumentLabel(input: {
  currentKey: string | null;
  currentLabel: string | null;
  bizKey: string;
  registryDisplayName: string;
  trustedAccountName: string | null;
}) {
  const currentLabel = normalizeLabel(input.currentLabel);
  if (input.trustedAccountName) {
    return input.trustedAccountName;
  }

  if (input.currentKey === input.bizKey && currentLabel) {
    return currentLabel;
  }

  return input.registryDisplayName;
}

function hasNonEmptyLabel(value: string | null) {
  return Boolean(normalizeLabel(value));
}

function normalizeLabel(value: string | null) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}
