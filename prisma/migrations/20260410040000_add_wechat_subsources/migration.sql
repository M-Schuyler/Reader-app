-- CreateTable
CREATE TABLE "WechatSubsource" (
    "biz" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "isPlaceholder" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WechatSubsource_pkey" PRIMARY KEY ("biz")
);
