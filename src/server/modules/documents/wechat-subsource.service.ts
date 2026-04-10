import type { WechatSubsourceRecord } from "./wechat-subsource.repository";
import {
  findWechatSubsourceByBiz as defaultFindWechatSubsourceByBiz,
  upsertWechatSubsourceRecord as defaultUpsertWechatSubsourceRecord,
} from "./wechat-subsource.repository";

const WECHAT_PLACEHOLDER_LABEL_PREFIX = "未命名公众号";
const WECHAT_BIZ_PREFIX_LENGTH = 6;

export type UpsertWechatSubsourceInput = {
  biz: string;
  displayName?: string | null;
};

export type UpsertWechatSubsourceDependencies = {
  findWechatSubsourceByBiz?: typeof defaultFindWechatSubsourceByBiz;
  upsertWechatSubsourceRecord?: typeof defaultUpsertWechatSubsourceRecord;
};

export async function upsertWechatSubsource(
  input: UpsertWechatSubsourceInput,
  deps: UpsertWechatSubsourceDependencies = {},
): Promise<WechatSubsourceRecord> {
  const findWechatSubsourceByBiz = deps.findWechatSubsourceByBiz ?? defaultFindWechatSubsourceByBiz;
  const upsertWechatSubsourceRecord = deps.upsertWechatSubsourceRecord ?? defaultUpsertWechatSubsourceRecord;
  const biz = normalizeBiz(input.biz);
  const displayName = normalizeDisplayName(input.displayName);
  const existing = await findWechatSubsourceByBiz(biz);

  if (!existing) {
    return upsertWechatSubsourceRecord({
      biz,
      displayName: displayName ?? buildPlaceholderDisplayName(biz),
      isPlaceholder: displayName === null,
    });
  }

  if (existing.isPlaceholder) {
    if (displayName === null) {
      return existing;
    }

    return upsertWechatSubsourceRecord({
      biz,
      displayName,
      isPlaceholder: false,
    });
  }

  if (displayName === null || existing.displayName === displayName) {
    return existing;
  }

  return upsertWechatSubsourceRecord({
    biz,
    displayName,
    isPlaceholder: false,
  });
}

function normalizeBiz(value: string) {
  const normalized = value.trim();
  if (!normalized) {
    throw new Error("Wechat subsource biz is required.");
  }

  return normalized;
}

function normalizeDisplayName(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function buildPlaceholderDisplayName(biz: string) {
  return `${WECHAT_PLACEHOLDER_LABEL_PREFIX} ${biz.slice(0, WECHAT_BIZ_PREFIX_LENGTH)}…`;
}
