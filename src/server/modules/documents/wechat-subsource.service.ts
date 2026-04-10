import type { WechatSubsourceRecord } from "./wechat-subsource.repository";
import {
  createWechatSubsource as defaultCreateWechatSubsource,
  findWechatSubsourceByBiz as defaultFindWechatSubsourceByBiz,
  updateWechatSubsource as defaultUpdateWechatSubsource,
} from "./wechat-subsource.repository";

const WECHAT_PLACEHOLDER_LABEL_PREFIX = "未命名公众号";
const WECHAT_BIZ_PREFIX_LENGTH = 6;

export type UpsertWechatSubsourceInput = {
  biz: string;
  displayName?: string | null;
};

export type UpsertWechatSubsourceDependencies = {
  findWechatSubsourceByBiz?: typeof defaultFindWechatSubsourceByBiz;
  createWechatSubsource?: typeof defaultCreateWechatSubsource;
  updateWechatSubsource?: typeof defaultUpdateWechatSubsource;
};

type PersistWechatSubsourceInput = {
  biz: string;
  displayName: string;
  isPlaceholder: boolean;
};

export async function upsertWechatSubsource(
  input: UpsertWechatSubsourceInput,
  deps: UpsertWechatSubsourceDependencies = {},
): Promise<WechatSubsourceRecord> {
  const findWechatSubsourceByBiz = deps.findWechatSubsourceByBiz ?? defaultFindWechatSubsourceByBiz;
  const createWechatSubsource = deps.createWechatSubsource ?? defaultCreateWechatSubsource;
  const updateWechatSubsource = deps.updateWechatSubsource ?? defaultUpdateWechatSubsource;
  const biz = normalizeBiz(input.biz);
  const displayName = normalizeDisplayName(input.displayName);
  const next = buildNextSubsourceState(biz, displayName);

  const existing = await findWechatSubsourceByBiz(biz);
  if (existing) {
    return reconcileExistingSubsource(existing, next, updateWechatSubsource);
  }

  try {
    return await createWechatSubsource(next);
  } catch (error) {
    if (!isUniqueConstraintViolation(error)) {
      throw error;
    }
  }

  const conflicted = await findWechatSubsourceByBiz(biz);
  if (!conflicted) {
    throw new Error(`Wechat subsource ${biz} conflicted during create but could not be reloaded.`);
  }

  return reconcileExistingSubsource(conflicted, next, updateWechatSubsource);
}

function reconcileExistingSubsource(
  existing: WechatSubsourceRecord,
  next: PersistWechatSubsourceInput,
  updateWechatSubsource: typeof defaultUpdateWechatSubsource,
) {
  if (next.isPlaceholder) {
    return existing;
  }

  if (existing.displayName === next.displayName && existing.isPlaceholder === false) {
    return existing;
  }

  return updateWechatSubsource(existing.biz, {
    displayName: next.displayName,
    isPlaceholder: false,
  });
}

function buildNextSubsourceState(biz: string, displayName: string | null): PersistWechatSubsourceInput {
  return {
    biz,
    displayName: displayName ?? buildPlaceholderDisplayName(biz),
    isPlaceholder: displayName === null,
  };
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

function isUniqueConstraintViolation(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002";
}
