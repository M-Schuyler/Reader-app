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
