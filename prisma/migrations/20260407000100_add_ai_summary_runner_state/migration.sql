CREATE TABLE "AiSummaryRunnerState" (
    "provider" TEXT NOT NULL,
    "cooldownUntil" TIMESTAMP(3),
    "lastCooldownMs" INTEGER NOT NULL DEFAULT 0,
    "consecutiveRateLimitCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiSummaryRunnerState_pkey" PRIMARY KEY ("provider")
);
