import { prisma } from "@/server/db/client";

export type WechatSubsourceRecord = {
  biz: string;
  displayName: string;
  isPlaceholder: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const wechatSubsourceSelect = {
  biz: true,
  displayName: true,
  isPlaceholder: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function findWechatSubsourceByBiz(biz: string): Promise<WechatSubsourceRecord | null> {
  return prisma.wechatSubsource.findUnique({
    where: {
      biz,
    },
    select: wechatSubsourceSelect,
  });
}

export async function listWechatSubsourcesByBiz(bizValues: string[]): Promise<WechatSubsourceRecord[]> {
  const normalizedBizValues = [...new Set(bizValues.map((biz) => biz.trim()).filter(Boolean))];
  if (normalizedBizValues.length === 0) {
    return [];
  }

  return prisma.wechatSubsource.findMany({
    where: {
      biz: {
        in: normalizedBizValues,
      },
    },
    select: wechatSubsourceSelect,
  });
}
