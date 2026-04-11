export type ContentOriginOption = {
  value: string;
  label: string;
  count: number;
};

export type ContentOriginRow = {
  id: string;
  author: string | null;
  sourceUrl: string | null;
  canonicalUrl: string | null;
  contentOriginKey: string | null;
  contentOriginLabel: string | null;
  rawHtml: string | null;
};

export type ContentOriginIndex = {
  options: ContentOriginOption[];
  documentOriginById: Record<string, string>;
};

export type WechatBizLabelMap = ReadonlyMap<string, string>;

export type ResolvedContentOrigin = {
  key: string;
  label: string;
};

export type DerivedContentOriginMetadata = {
  isWechat: boolean;
  key: string | null;
  label: string | null;
};

export type WechatSubsourceSyncInput = {
  biz: string;
  displayName: string | null;
};

type ContentOriginInput = {
  author?: string | null;
  canonicalUrl?: string | null;
  finalUrl?: string | null;
  rawHtml?: string | null;
  sourceUrl?: string | null;
  wechatAccountName?: string | null;
};

const WECHAT_UNKNOWN_ORIGIN = "wechat:unknown";
const WECHAT_UNKNOWN_LABEL = "未识别公众号";
const WECHAT_DOMINANT_BIZ_MIN_COUNT = 3;
const WECHAT_DOMINANT_BIZ_MIN_SHARE = 0.7;
const WECHAT_DOMINANT_BIZ_MIN_RATIO = 2;

export function deriveContentOriginMetadata(input: ContentOriginInput): DerivedContentOriginMetadata {
  const url = parseUrl(input.canonicalUrl) ?? parseUrl(input.finalUrl) ?? parseUrl(input.sourceUrl);

  if (url?.hostname !== "mp.weixin.qq.com") {
    return {
      isWechat: false,
      key: null,
      label: null,
    };
  }

  const nickname = normalizeLabel(
    input.wechatAccountName ?? extractWeChatNickname(input.rawHtml ?? null) ?? input.author ?? null,
  );
  const biz = normalizeLabel(url.searchParams.get("__biz"));

  if (biz) {
    return {
      isWechat: true,
      key: buildWeChatBizOriginValue(biz),
      label: nickname ?? WECHAT_UNKNOWN_LABEL,
    };
  }

  if (nickname) {
    return {
      isWechat: true,
      key: buildWeChatNicknameOriginValue(nickname),
      label: nickname,
    };
  }

  return {
    isWechat: true,
    key: WECHAT_UNKNOWN_ORIGIN,
    label: WECHAT_UNKNOWN_LABEL,
  };
}

export function deriveWechatSubsourceSyncInput(
  origin: DerivedContentOriginMetadata,
  input?: {
    wechatAccountName?: string | null;
  },
): WechatSubsourceSyncInput | null {
  if (!origin.isWechat || !origin.key) {
    return null;
  }

  const biz = readWeChatBizFromOriginKey(origin.key);
  if (!biz) {
    return null;
  }

  return {
    biz,
    displayName: normalizeLabel(input?.wechatAccountName ?? null) ?? (origin.label === WECHAT_UNKNOWN_LABEL ? null : normalizeLabel(origin.label)),
  };
}

export async function syncWechatSubsourceFromContentOrigin(
  origin: DerivedContentOriginMetadata,
  input: {
    wechatAccountName?: string | null;
  } | null | undefined,
  upsertWechatSubsource: (input: WechatSubsourceSyncInput) => Promise<unknown>,
) {
  const syncInput = deriveWechatSubsourceSyncInput(origin, input ?? undefined);
  if (!syncInput) {
    return null;
  }

  return upsertWechatSubsource(syncInput);
}

export function collectWechatBizFromContentOriginRows(rows: ContentOriginRow[]) {
  return [...new Set(rows.map((row) => normalizeContentOriginRow(row)?.biz ?? null).filter((biz): biz is string => Boolean(biz)))];
}

export function resolveDocumentContentOrigin(
  row: ContentOriginRow,
  options: {
    wechatBizLabels?: WechatBizLabelMap;
  } = {},
): ResolvedContentOrigin | null {
  const normalizedRow = normalizeContentOriginRow(row);
  if (!normalizedRow) {
    return null;
  }

  return {
    key: normalizedRow.key,
    label: resolveNormalizedContentOriginLabel(normalizedRow, options.wechatBizLabels),
  };
}

export function shouldEnableContentOriginForSourceDetail(input: {
  sourceUrl?: string | null;
  representativeCanonicalUrl?: string | null;
  representativeSourceUrl?: string | null;
}) {
  return [input.sourceUrl, input.representativeCanonicalUrl, input.representativeSourceUrl].some((value) =>
    isWechatUrl(value),
  );
}

export function buildContentOriginIndex(
  rows: ContentOriginRow[],
  options: {
    wechatBizLabels?: WechatBizLabelMap;
  } = {},
): ContentOriginIndex {
  const normalizedRows = rows
    .map((row) => normalizeContentOriginRow(row))
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  if (normalizedRows.length === 0) {
    return {
      options: [],
      documentOriginById: {},
    };
  }

  const bizLabels = new Map<string, string>();
  const registryLabels = options.wechatBizLabels ?? new Map<string, string>();
  const nicknameBizCounts = new Map<string, Map<string, number>>();

  for (const row of normalizedRows) {
    const registryLabel = row.biz ? registryLabels.get(row.biz) ?? null : null;
    if (row.biz && registryLabel) {
      bizLabels.set(row.biz, registryLabel);
    }

    if (row.biz && row.label && row.label !== WECHAT_UNKNOWN_LABEL && !bizLabels.has(row.biz)) {
      // Transitional fallback: registry-backed biz labels should win whenever available.
      // Remove stored-label fallback after the wechat:nickname:* and historical label backfill exit criteria are complete.
      bizLabels.set(row.biz, row.label);
    }

    if (!row.biz || !row.nickname || row.nickname === WECHAT_UNKNOWN_LABEL) {
      continue;
    }

    const bizCounts = nicknameBizCounts.get(row.nickname) ?? new Map<string, number>();
    bizCounts.set(row.biz, (bizCounts.get(row.biz) ?? 0) + 1);
    nicknameBizCounts.set(row.nickname, bizCounts);
  }

  const nicknameToBiz = resolvePreferredBizByNickname(nicknameBizCounts);
  const optionCounts = new Map<string, number>();
  const optionLabels = new Map<string, string>();
  const documentOriginById: Record<string, string> = {};

  for (const row of normalizedRows) {
    const matchingBiz = row.biz ?? (row.nickname ? nicknameToBiz.get(row.nickname) ?? null : null);
    const value =
      row.key === WECHAT_UNKNOWN_ORIGIN
        ? WECHAT_UNKNOWN_ORIGIN
        : matchingBiz
          ? buildWeChatBizOriginValue(matchingBiz)
          : row.key;
    const label =
      value === WECHAT_UNKNOWN_ORIGIN
        ? WECHAT_UNKNOWN_LABEL
        : matchingBiz
          ? bizLabels.get(matchingBiz) ?? row.label ?? row.nickname ?? WECHAT_UNKNOWN_LABEL
          : resolveNormalizedContentOriginLabel(row, registryLabels);

    documentOriginById[row.id] = value;
    optionCounts.set(value, (optionCounts.get(value) ?? 0) + 1);

    if (!optionLabels.has(value)) {
      optionLabels.set(value, label);
    }
  }

  const contentOriginOptions = [...optionCounts.entries()]
    .map(([value, count]) => ({
      value,
      label: optionLabels.get(value) ?? WECHAT_UNKNOWN_LABEL,
      count,
    }))
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }

      if (left.value === WECHAT_UNKNOWN_ORIGIN) {
        return -1;
      }

      if (right.value === WECHAT_UNKNOWN_ORIGIN) {
        return 1;
      }

      return left.label.localeCompare(right.label, "zh-CN");
    });

  return {
    options: contentOriginOptions,
    documentOriginById,
  };
}

function normalizeContentOriginRow(row: ContentOriginRow) {
  const derivedFromStored = normalizeStoredWechatOrigin(row.contentOriginKey, row.contentOriginLabel, row.canonicalUrl, row.sourceUrl);

  if (derivedFromStored) {
    return {
      id: row.id,
      ...derivedFromStored,
    };
  }

  // Transitional fallback for historical WeChat documents that have not been backfilled yet.
  // Remove this branch in the next PR once every WeChat document has a non-null contentOriginKey.
  const derived = deriveContentOriginMetadata({
    author: row.author,
    canonicalUrl: row.canonicalUrl,
    rawHtml: row.rawHtml,
    sourceUrl: row.sourceUrl,
  });

  if (!derived.isWechat || !derived.key) {
    return null;
  }

  return {
    id: row.id,
    key: derived.key,
    label: derived.label,
    biz: readWeChatBizFromOriginKey(derived.key),
    nickname:
      derived.key === WECHAT_UNKNOWN_ORIGIN || derived.label === WECHAT_UNKNOWN_LABEL
        ? null
        : normalizeLabel(derived.label),
  };
}

function resolveNormalizedContentOriginLabel(
  row: {
    key: string;
    label: string | null;
    biz: string | null;
    nickname: string | null;
  },
  wechatBizLabels: WechatBizLabelMap = new Map<string, string>(),
) {
  if (row.key === WECHAT_UNKNOWN_ORIGIN) {
    return WECHAT_UNKNOWN_LABEL;
  }

  if (row.biz) {
    return wechatBizLabels.get(row.biz) ?? row.label ?? row.nickname ?? WECHAT_UNKNOWN_LABEL;
  }

  return row.label ?? row.nickname ?? WECHAT_UNKNOWN_LABEL;
}

function normalizeStoredWechatOrigin(
  key: string | null,
  label: string | null,
  canonicalUrl: string | null,
  sourceUrl: string | null,
) {
  const url = parseUrl(canonicalUrl) ?? parseUrl(sourceUrl);
  if (url?.hostname !== "mp.weixin.qq.com" || !key) {
    return null;
  }

  const normalizedLabel = normalizeLabel(label) ?? (key === WECHAT_UNKNOWN_ORIGIN ? WECHAT_UNKNOWN_LABEL : null);
  return {
    key,
    label: normalizedLabel,
    biz: readWeChatBizFromOriginKey(key),
    nickname: key === WECHAT_UNKNOWN_ORIGIN || normalizedLabel === WECHAT_UNKNOWN_LABEL ? null : normalizedLabel,
  };
}

function resolvePreferredBizByNickname(nicknameBizCounts: Map<string, Map<string, number>>) {
  const nicknameToBiz = new Map<string, string | null>();

  for (const [nickname, bizCounts] of nicknameBizCounts.entries()) {
    const rankedBizCounts = [...bizCounts.entries()].sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }

      return left[0].localeCompare(right[0], "en");
    });

    if (rankedBizCounts.length === 1) {
      nicknameToBiz.set(nickname, rankedBizCounts[0][0]);
      continue;
    }

    const [[leadingBiz, leadingCount], [, runnerUpCount]] = rankedBizCounts;
    const totalCount = rankedBizCounts.reduce((sum, [, count]) => sum + count, 0);

    nicknameToBiz.set(
      nickname,
      isClearlyDominantWeChatBiz(leadingCount, runnerUpCount, totalCount) ? leadingBiz : null,
    );
  }

  return nicknameToBiz;
}

function isClearlyDominantWeChatBiz(leadingCount: number, runnerUpCount: number, totalCount: number) {
  if (leadingCount < WECHAT_DOMINANT_BIZ_MIN_COUNT) {
    return false;
  }

  if (leadingCount / totalCount < WECHAT_DOMINANT_BIZ_MIN_SHARE) {
    return false;
  }

  return leadingCount >= runnerUpCount * WECHAT_DOMINANT_BIZ_MIN_RATIO;
}

export function buildWeChatBizOriginValue(value: string) {
  return `wechat:biz:${value}`;
}

function buildWeChatNicknameOriginValue(value: string) {
  return `wechat:nickname:${value}`;
}

export function readWeChatBizFromOriginKey(value: string) {
  return value.startsWith("wechat:biz:") ? value.slice("wechat:biz:".length) : null;
}

function extractWeChatNickname(rawHtml: string | null) {
  if (!rawHtml) {
    return null;
  }

  const jsDecoded =
    rawHtml.match(/\bnick_name\s*:\s*JsDecode\(\s*'([\s\S]{1,160}?)'\s*\)/i)?.[1] ?? null;
  const direct =
    rawHtml.match(/\bprofile_nickname\s*[:=]\s*["']([^"'\\\n]{1,80})["']/i)?.[1] ??
    rawHtml.match(/\bnickname\s*[:=]\s*(?:htmlDecode\()?["']([^"'\\\n]{1,80})["']\)?/i)?.[1] ??
    rawHtml.match(/<span[^>]+id=["']js_name["'][^>]*>([^<]{1,80})<\/span>/i)?.[1] ??
    null;

  return normalizeLabel(decodeWeChatJsString(jsDecoded) ?? direct);
}

function decodeWeChatJsString(value: string | null) {
  if (!value) {
    return null;
  }

  return value
    .replace(/\\x5c/g, "\\")
    .replace(/\\x0d/g, "\r")
    .replace(/\\x0a/g, "\n")
    .replace(/\\x22/g, '"')
    .replace(/\\x26/g, "&")
    .replace(/\\x27/g, "'")
    .replace(/\\x3c/g, "<")
    .replace(/\\x3e/g, ">");
}

function normalizeLabel(value: string | null) {
  const normalized = value?.replace(/\s+/g, " ").trim();
  return normalized ? normalized : null;
}

function parseUrl(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isWechatUrl(value: string | null | undefined) {
  return parseUrl(value)?.hostname === "mp.weixin.qq.com";
}
