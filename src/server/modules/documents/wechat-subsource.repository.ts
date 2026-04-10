import { Prisma } from "@prisma/client";
import { prisma } from "@/server/db/client";

export const wechatSubsourceRecordArgs = Prisma.validator<Prisma.WechatSubsourceDefaultArgs>()({
  select: {
    biz: true,
    displayName: true,
    isPlaceholder: true,
    createdAt: true,
    updatedAt: true,
  },
});

export type WechatSubsourceRecord = Prisma.WechatSubsourceGetPayload<typeof wechatSubsourceRecordArgs>;

export async function findWechatSubsourceByBiz(biz: string) {
  return prisma.wechatSubsource.findUnique({
    where: {
      biz,
    },
    ...wechatSubsourceRecordArgs,
  });
}

export async function upsertWechatSubsourceRecord(input: {
  biz: string;
  displayName: string;
  isPlaceholder: boolean;
}) {
  return prisma.wechatSubsource.upsert({
    where: {
      biz: input.biz,
    },
    create: {
      biz: input.biz,
      displayName: input.displayName,
      isPlaceholder: input.isPlaceholder,
    },
    update: {
      displayName: input.displayName,
      isPlaceholder: input.isPlaceholder,
    },
    ...wechatSubsourceRecordArgs,
  });
}
