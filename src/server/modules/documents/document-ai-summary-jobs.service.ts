import {
  AiSummaryStatus,
  DocumentType,
  IngestionJobKind,
  IngestionJobStatus,
  IngestionStatus,
  type Prisma,
} from "@prisma/client";
import { RouteError } from "@/server/api/response";
import { prisma } from "@/server/db/client";
import { generateDocumentAiSummary } from "./document-ai-summary.service";
import { documentDetailArgs, type DocumentDetailRecord } from "./document.repository";
import type {
  BackfillDocumentAiSummaryJobsResponseData,
  GenerateAiSummaryError,
  RunDocumentAiSummaryJobsResponseData,
  SummaryQueueStatusResponseData,
  SummaryRunnerThrottle,
  SweepDocumentAiSummaryJobsResponseData,
} from "./document.types";

const DEFAULT_SUMMARY_JOB_BATCH_SIZE = 5;
const MAX_SUMMARY_JOB_BATCH_SIZE = 20;
const DEFAULT_SUMMARY_RATE_LIMIT_COOLDOWN_MS = 15_000;
const MAX_SUMMARY_RATE_LIMIT_COOLDOWN_MS = 120_000;
const SUMMARY_RATE_LIMIT_JITTER_MS = 1_000;
const DEFAULT_SUMMARY_SWEEP_MAX_RUNS = 6;
const DEFAULT_SUMMARY_SWEEP_MAX_RUNTIME_MS = 45_000;
const SUMMARY_RUNNER_BUSY_MIN_BACKOFF_MS = 400;
const SUMMARY_RUNNER_BUSY_BACKOFF_RANGE_MS = 600;
const SUMMARY_RUNNER_FAIRNESS_GAP_MIN_MS = 50;
const SUMMARY_RUNNER_FAIRNESS_GAP_RANGE_MS = 100;
const AI_SUMMARY_PROVIDER_LOCK_NAMESPACE = 41_021;
const AI_SUMMARY_PROVIDER_LOCK_KEYS = {
  gemini: 1,
  openai: 2,
} as const;
const AI_SUMMARY_PROVIDER_LOCK_MAX_WAIT_MS = 5_000;
const AI_SUMMARY_PROVIDER_LOCK_TRANSACTION_TIMEOUT_MS = 30_000;

type SummaryAiProvider = keyof typeof AI_SUMMARY_PROVIDER_LOCK_KEYS;
type SummaryDbClient = Prisma.TransactionClient | typeof prisma;
type AutoAiSummaryCandidate = {
  ingestionStatus: IngestionStatus;
  aiSummary: string | null;
  aiSummaryStatus: AiSummaryStatus | null;
  excerpt: string | null;
  content: {
    plainText: string;
  } | null;
};
type SummaryJobResult = RunDocumentAiSummaryJobsResponseData["results"][number];
type PendingSummaryJobRecord = Prisma.IngestionJobGetPayload<Record<string, never>>;
type SummaryRunnerStateSnapshot = {
  cooldownUntil: Date | null;
  lastCooldownMs: number;
  consecutiveRateLimitCount: number;
};
type SummaryRunNextJobResult = {
  result: SummaryJobResult | null;
  throttle: SummaryRunnerThrottle | null;
};
type WithAiSummaryProviderLockResult<T> = { status: "acquired"; value: T } | { status: "runner_busy" };
type PrioritizeDocumentAiSummaryResult = {
  document: DocumentDetailRecord;
  summary: {
    status: "generated" | "queued" | "skipped" | "blocked" | "failed";
    error: GenerateAiSummaryError | null;
    throttle: SummaryRunnerThrottle | null;
    runtimeIssues: string[];
  };
};
type RunPendingDocumentAiSummaryJobsDeps = {
  now?: () => number;
  random?: () => number;
  sleep?: (ms: number) => Promise<void>;
  runNextJob?: () => Promise<SummaryRunNextJobResult>;
};
type PrioritizeDocumentAiSummaryDeps = {
  getDocument?: (documentId: string) => Promise<DocumentDetailRecord | null>;
  ensurePendingDocument?: (document: DocumentDetailRecord, tx?: Prisma.TransactionClient) => Promise<DocumentDetailRecord>;
  getRuntimeIssues?: () => string[];
  withLock?: (
    work: (context: { tx: Prisma.TransactionClient; provider: SummaryAiProvider }) => Promise<PrioritizeDocumentAiSummaryResult | null>,
  ) => Promise<WithAiSummaryProviderLockResult<PrioritizeDocumentAiSummaryResult | null>>;
  now?: () => number;
  random?: () => number;
};
type SweepPendingDocumentAiSummaryJobsOptions = {
  limit?: number;
  maxRuns?: number;
  maxRuntimeMs?: number;
};
type SweepPendingDocumentAiSummaryJobsDeps = {
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  runBatch?: (limit: number) => Promise<RunDocumentAiSummaryJobsResponseData>;
};
type SummaryQueueStatusDeps = {
  getRuntimeIssues?: () => string[];
  countPending?: () => Promise<number>;
  getState?: (provider: SummaryAiProvider) => Promise<SummaryRunnerStateSnapshot>;
  now?: () => number;
};

export function getSummaryRuntimeIssues(options?: { requireInternalApiSecret?: boolean }) {
  const issues: string[] = [];
  const requireInternalApiSecret = options?.requireInternalApiSecret ?? true;
  const provider = normalizeAiProvider(process.env.AI_PROVIDER);

  if (!provider) {
    issues.push('AI_PROVIDER is not supported. Expected "gemini" or "openai".');
  } else if (provider === "gemini" && !process.env.GEMINI_API_KEY?.trim()) {
    issues.push("GEMINI_API_KEY is not configured.");
  } else if (provider === "openai" && !process.env.OPENAI_API_KEY?.trim()) {
    issues.push("OPENAI_API_KEY is not configured.");
  }

  if (requireInternalApiSecret && !hasAnyInternalAutomationSecret()) {
    issues.push("Neither INTERNAL_API_SECRET nor CRON_SECRET is configured.");
  }

  return issues;
}

export function shouldEnqueueAutomaticAiSummary(document: AutoAiSummaryCandidate) {
  if (document.ingestionStatus !== IngestionStatus.READY) {
    return false;
  }

  if (document.aiSummary || document.aiSummaryStatus) {
    return false;
  }

  return Boolean(normalizeSummarySourceText(document.content?.plainText) || normalizeSummarySourceText(document.excerpt));
}

export function shouldBackfillAutomaticAiSummary(document: AutoAiSummaryCandidate) {
  if (document.ingestionStatus !== IngestionStatus.READY) {
    return false;
  }

  if (document.aiSummary) {
    return false;
  }

  if (document.aiSummaryStatus === AiSummaryStatus.PENDING) {
    return false;
  }

  return Boolean(normalizeSummarySourceText(document.content?.plainText) || normalizeSummarySourceText(document.excerpt));
}

export async function queueAutomaticDocumentAiSummary(
  document: DocumentDetailRecord,
  options?: { allowRetry?: boolean },
) {
  const allowRetry = options?.allowRetry ?? false;
  const shouldQueue = allowRetry ? shouldBackfillAutomaticAiSummary(document) : shouldEnqueueAutomaticAiSummary(document);

  if (!shouldQueue) {
    return document;
  }

  const existingJob = await prisma.ingestionJob.findFirst({
    where: {
      kind: IngestionJobKind.GENERATE_AI_SUMMARY,
      documentId: document.id,
      status: {
        in: [IngestionJobStatus.PENDING, IngestionJobStatus.PROCESSING],
      },
    },
  });

  if (existingJob) {
    return document.aiSummaryStatus === AiSummaryStatus.PENDING
      ? document
      : updateDocumentAiSummaryStateWithClient(prisma, document.id, AiSummaryStatus.PENDING);
  }

  if (document.aiSummaryStatus === AiSummaryStatus.PENDING) {
    await prisma.ingestionJob.create({
      data: {
        kind: IngestionJobKind.GENERATE_AI_SUMMARY,
        status: IngestionJobStatus.PENDING,
        documentId: document.id,
        sourceUrl: document.sourceUrl ?? document.canonicalUrl,
      },
    });

    return document;
  }

  const pendingDocument = await updateDocumentAiSummaryStateWithClient(prisma, document.id, AiSummaryStatus.PENDING);
  await prisma.ingestionJob.create({
    data: {
      kind: IngestionJobKind.GENERATE_AI_SUMMARY,
      status: IngestionJobStatus.PENDING,
      documentId: document.id,
      sourceUrl: document.sourceUrl ?? document.canonicalUrl,
    },
  });

  return pendingDocument;
}

export async function queueAndRunAutomaticDocumentAiSummary(document: DocumentDetailRecord) {
  const queuedDocument = await queueAutomaticDocumentAiSummary(document);

  if (getSummaryRuntimeIssues({ requireInternalApiSecret: false }).length > 0) {
    return queuedDocument;
  }

  return (await prioritizeDocumentAiSummary(queuedDocument.id))?.document ?? queuedDocument;
}

export async function prioritizeDocumentAiSummary(
  documentId: string,
  deps: PrioritizeDocumentAiSummaryDeps = {},
): Promise<PrioritizeDocumentAiSummaryResult | null> {
  const getDocument = deps.getDocument ?? ((targetDocumentId: string) => getDocumentByIdWithClient(prisma, targetDocumentId));
  const ensurePendingDocument =
    deps.ensurePendingDocument ??
    ((document: DocumentDetailRecord, tx?: Prisma.TransactionClient) => {
      if (!tx) {
        throw new Error("Priority summary path requires a transaction client.");
      }

      return ensurePendingDocumentAiSummaryJob(tx, document, { allowRetry: true });
    });
  const getRuntimeIssues =
    deps.getRuntimeIssues ?? (() => getSummaryRuntimeIssues({ requireInternalApiSecret: false }));
  const provider = getConfiguredSummaryAiProvider();
  const now = deps.now ?? Date.now;
  const withLock =
    deps.withLock ??
    ((work: (context: { tx: Prisma.TransactionClient; provider: SummaryAiProvider }) => Promise<PrioritizeDocumentAiSummaryResult | null>) =>
      withAiSummaryProviderLock(provider, async (tx) => work({ tx, provider })));

  const existingDocument = await getDocument(documentId);
  if (!existingDocument) {
    return null;
  }

  if (existingDocument.aiSummary) {
    return buildPrioritizeSummaryResult(existingDocument, {
      status: "skipped",
      error: null,
      throttle: null,
      runtimeIssues: [],
    });
  }

  const runtimeIssues = getRuntimeIssues();
  if (runtimeIssues.length > 0) {
    return buildPrioritizeSummaryResult(existingDocument, {
      status: "blocked",
      error: null,
      throttle: null,
      runtimeIssues,
    });
  }

  const lockResult = await withLock(async ({ tx, provider: lockedProvider }) => {
    const lockedDocument = await getDocumentByIdWithClient(tx, documentId);
    if (!lockedDocument) {
      return null;
    }

    if (lockedDocument.aiSummary) {
      return buildPrioritizeSummaryResult(lockedDocument, {
        status: "skipped",
        error: null,
        throttle: null,
        runtimeIssues: [],
      });
    }

    const queuedDocument = await ensurePendingDocument(lockedDocument, tx);

    if (queuedDocument.aiSummary) {
      return buildPrioritizeSummaryResult(queuedDocument, {
        status: "skipped",
        error: null,
        throttle: null,
        runtimeIssues: [],
      });
    }

    if (queuedDocument.aiSummaryStatus !== AiSummaryStatus.PENDING) {
      return buildPrioritizeSummaryResult(queuedDocument, {
        status: "skipped",
        error: null,
        throttle: null,
        runtimeIssues: [],
      });
    }

    const activeThrottle = getActiveSummaryRunnerThrottle(await getAiSummaryRunnerState(tx, lockedProvider), now());
    if (activeThrottle) {
      return buildPrioritizeSummaryResult(queuedDocument, {
        status: "queued",
        error: null,
        throttle: activeThrottle,
        runtimeIssues: [],
      });
    }

    const run = await runPendingSummaryJobForDocument(tx, lockedProvider, queuedDocument.id, {
      now,
      random: deps.random,
    });

    if (!run.result) {
      return buildPrioritizeSummaryResult(run.document ?? queuedDocument, {
        status: run.document?.aiSummary ? "skipped" : "queued",
        error: null,
        throttle: run.throttle,
        runtimeIssues: [],
      });
    }

    if (run.result.outcome === "generated") {
      return buildPrioritizeSummaryResult(run.document ?? queuedDocument, {
        status: "generated",
        error: null,
        throttle: null,
        runtimeIssues: [],
      });
    }

    if (run.result.outcome === "deferred") {
      return buildPrioritizeSummaryResult(run.document ?? queuedDocument, {
        status: "queued",
        error: run.result.error,
        throttle: run.throttle,
        runtimeIssues: [],
      });
    }

    if (run.result.outcome === "failed") {
      return buildPrioritizeSummaryResult(run.document ?? queuedDocument, {
        status: "failed",
        error: run.result.error,
        throttle: null,
        runtimeIssues: [],
      });
    }

    return buildPrioritizeSummaryResult(run.document ?? queuedDocument, {
      status: "skipped",
      error: null,
      throttle: null,
      runtimeIssues: [],
    });
  });

  if (lockResult.status === "runner_busy") {
    return buildPrioritizeSummaryResult(existingDocument, {
      status: "queued",
      error: null,
      throttle: buildRunnerBusyThrottle(deps.random),
      runtimeIssues: [],
    });
  }

  return lockResult.value;
}

export async function backfillAutomaticDocumentAiSummaryJobs(
  limitInput?: number,
): Promise<BackfillDocumentAiSummaryJobsResponseData> {
  const documents = await prisma.document.findMany({
    where: {
      type: DocumentType.WEB_PAGE,
      ingestionStatus: IngestionStatus.READY,
      aiSummary: null,
      OR: [{ aiSummaryStatus: null }, { aiSummaryStatus: AiSummaryStatus.FAILED }],
    },
    orderBy: {
      createdAt: "asc",
    },
    take: normalizeSummaryJobBatchLimit(limitInput),
    ...documentDetailArgs,
  });

  let queued = 0;
  let skipped = 0;
  const documentIds: string[] = [];

  for (const document of documents) {
    if (!shouldBackfillAutomaticAiSummary(document)) {
      skipped += 1;
      continue;
    }

    const queuedDocument = await queueAutomaticDocumentAiSummary(document, { allowRetry: true });
    if (queuedDocument.aiSummaryStatus === AiSummaryStatus.PENDING) {
      queued += 1;
      documentIds.push(queuedDocument.id);
      continue;
    }

    skipped += 1;
  }

  return {
    scanned: documents.length,
    queued,
    skipped,
    documentIds,
  };
}

export async function runPendingDocumentAiSummaryJobs(
  limitInput?: number,
  deps: RunPendingDocumentAiSummaryJobsDeps = {},
): Promise<RunDocumentAiSummaryJobsResponseData> {
  const limit = normalizeSummaryJobBatchLimit(limitInput);
  const random = deps.random;
  const sleep = deps.sleep ?? sleepForSummarySweep;
  const runNextJob =
    deps.runNextJob ??
    (() =>
      runNextPendingSummaryJob({
        now: deps.now ?? Date.now,
        random,
      }));

  const results: SummaryJobResult[] = [];
  let throttle: SummaryRunnerThrottle | null = null;

  for (let index = 0; index < limit; index += 1) {
    const nextRun = await runNextJob();

    if (nextRun.result) {
      results.push(nextRun.result);
    }

    if (nextRun.throttle) {
      throttle = nextRun.throttle;
      break;
    }

    if (!nextRun.result) {
      break;
    }

    if (index < limit - 1) {
      await sleep(resolveSummaryFairnessGapMs(random));
    }
  }

  return buildSummaryRunResponse(results, throttle);
}

export async function sweepPendingDocumentAiSummaryJobs(
  options: SweepPendingDocumentAiSummaryJobsOptions = {},
  deps: SweepPendingDocumentAiSummaryJobsDeps = {},
): Promise<SweepDocumentAiSummaryJobsResponseData> {
  const limit = normalizeSummaryJobBatchLimit(options.limit);
  const maxRuns = normalizeSummarySweepMaxRuns(options.maxRuns);
  const maxRuntimeMs = normalizeSummarySweepMaxRuntimeMs(options.maxRuntimeMs);
  const now = deps.now ?? Date.now;
  const sleep = deps.sleep ?? sleepForSummarySweep;
  const runBatch = deps.runBatch ?? ((batchLimit: number) => runPendingDocumentAiSummaryJobs(batchLimit));
  const startedAtMs = now();

  const totals: Omit<SweepDocumentAiSummaryJobsResponseData, "completed" | "stopReason" | "throttle"> = {
    runs: 0,
    processed: 0,
    generated: 0,
    failed: 0,
    skipped: 0,
    deferred: 0,
    waitedMs: 0,
  };

  let throttle: SummaryRunnerThrottle | null = null;

  while (totals.runs < maxRuns) {
    const run = await runBatch(limit);
    totals.runs += 1;
    totals.processed += run.processed;
    totals.generated += run.generated;
    totals.failed += run.failed;
    totals.skipped += run.skipped;
    totals.deferred += run.deferred;

    if (run.processed === 0 && !run.throttle) {
      return {
        ...totals,
        completed: true,
        stopReason: "queue_empty",
        throttle: null,
      };
    }

    throttle = run.throttle;
    if (!throttle) {
      continue;
    }

    const elapsedMs = now() - startedAtMs;
    const remainingBudgetMs = maxRuntimeMs - elapsedMs;

    if (remainingBudgetMs < throttle.retryAfterMs) {
      return {
        ...totals,
        completed: false,
        stopReason: throttle.reason === "runner_busy" ? "runner_busy" : "time_budget_exhausted",
        throttle,
      };
    }

    await sleep(throttle.retryAfterMs);
    totals.waitedMs += throttle.retryAfterMs;
    throttle = null;
  }

  return {
    ...totals,
    completed: false,
    stopReason: "max_runs_reached",
    throttle,
  };
}

export async function getSummaryQueueStatus(
  deps: SummaryQueueStatusDeps = {},
): Promise<SummaryQueueStatusResponseData> {
  const countPending =
    deps.countPending ??
    (() =>
      prisma.document.count({
        where: {
          aiSummaryStatus: AiSummaryStatus.PENDING,
        },
      }));
  const getRuntimeIssues =
    deps.getRuntimeIssues ?? (() => getSummaryRuntimeIssues({ requireInternalApiSecret: false }));
  const pendingCount = await countPending();
  const runtimeIssues = getRuntimeIssues();

  if (runtimeIssues.length > 0) {
    return {
      pendingCount,
      isAvailable: false,
      throttle: null,
    };
  }

  const provider = getConfiguredSummaryAiProvider();
  const getState = deps.getState ?? getAiSummaryRunnerStateSnapshot;

  return {
    pendingCount,
    isAvailable: true,
    throttle: getActiveSummaryRunnerThrottle(await getState(provider), (deps.now ?? Date.now)()),
  };
}

export function calculateNextSummaryRateLimitDelayMs(
  state: SummaryRunnerStateSnapshot,
  input: { retryAfterMs?: number },
  options?: { random?: () => number },
) {
  const providerDelayMs = normalizeRetryAfterMs(input.retryAfterMs);
  const baseDelayMs =
    providerDelayMs ??
    Math.min(
      state.lastCooldownMs > 0 ? state.lastCooldownMs * 2 : DEFAULT_SUMMARY_RATE_LIMIT_COOLDOWN_MS,
      MAX_SUMMARY_RATE_LIMIT_COOLDOWN_MS,
    );

  const jitterMs =
    baseDelayMs >= MAX_SUMMARY_RATE_LIMIT_COOLDOWN_MS
      ? 0
      : Math.min(
          Math.round((options?.random ?? Math.random)() * SUMMARY_RATE_LIMIT_JITTER_MS),
          MAX_SUMMARY_RATE_LIMIT_COOLDOWN_MS - baseDelayMs,
        );

  return Math.min(baseDelayMs + jitterMs, MAX_SUMMARY_RATE_LIMIT_COOLDOWN_MS);
}

/**
 * We intentionally keep this transaction open while a single AI provider call is in flight.
 * That means one Postgres connection and one advisory lock stay occupied for the full request.
 * This is an accepted tradeoff for the current per-job serialized runner. If provider latency
 * or throughput requirements grow, this should move to a lease-based design instead.
 */
export async function withAiSummaryProviderLock<T>(
  provider: SummaryAiProvider,
  work: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<WithAiSummaryProviderLockResult<T>> {
  return prisma.$transaction(
    async (tx) => {
      const lockRows = await tx.$queryRaw<Array<{ locked: boolean }>>`
        SELECT pg_try_advisory_xact_lock(
          CAST(${AI_SUMMARY_PROVIDER_LOCK_NAMESPACE} AS integer),
          CAST(${AI_SUMMARY_PROVIDER_LOCK_KEYS[provider]} AS integer)
        ) AS "locked"
      `;

      if (!lockRows[0]?.locked) {
        return { status: "runner_busy" };
      }

      const value = await work(tx);
      return {
        status: "acquired",
        value,
      };
    },
    {
      maxWait: AI_SUMMARY_PROVIDER_LOCK_MAX_WAIT_MS,
      timeout: AI_SUMMARY_PROVIDER_LOCK_TRANSACTION_TIMEOUT_MS,
    },
  );
}

export async function getAiSummaryRunnerState(
  tx: Prisma.TransactionClient,
  provider: SummaryAiProvider,
): Promise<SummaryRunnerStateSnapshot> {
  const state = await tx.aiSummaryRunnerState.findUnique({
    where: {
      provider,
    },
  });

  if (!state) {
    return {
      cooldownUntil: null,
      lastCooldownMs: 0,
      consecutiveRateLimitCount: 0,
    };
  }

  return {
    cooldownUntil: state.cooldownUntil,
    lastCooldownMs: state.lastCooldownMs,
    consecutiveRateLimitCount: state.consecutiveRateLimitCount,
  };
}

async function getAiSummaryRunnerStateSnapshot(provider: SummaryAiProvider): Promise<SummaryRunnerStateSnapshot> {
  const state = await prisma.aiSummaryRunnerState.findUnique({
    where: {
      provider,
    },
  });

  if (!state) {
    return {
      cooldownUntil: null,
      lastCooldownMs: 0,
      consecutiveRateLimitCount: 0,
    };
  }

  return {
    cooldownUntil: state.cooldownUntil,
    lastCooldownMs: state.lastCooldownMs,
    consecutiveRateLimitCount: state.consecutiveRateLimitCount,
  };
}

export async function applyAiSummaryRunnerCooldown(
  tx: Prisma.TransactionClient,
  provider: SummaryAiProvider,
  retryAfterMs: number | undefined,
  nowMs: number,
  options?: { random?: () => number },
): Promise<SummaryRunnerThrottle> {
  const currentState = await getAiSummaryRunnerState(tx, provider);
  const delayMs = calculateNextSummaryRateLimitDelayMs(currentState, { retryAfterMs }, options);
  const cooldownUntil = new Date(nowMs + delayMs);

  await tx.aiSummaryRunnerState.upsert({
    where: {
      provider,
    },
    create: {
      provider,
      cooldownUntil,
      lastCooldownMs: delayMs,
      consecutiveRateLimitCount: currentState.consecutiveRateLimitCount + 1,
    },
    update: {
      cooldownUntil,
      lastCooldownMs: delayMs,
      consecutiveRateLimitCount: currentState.consecutiveRateLimitCount + 1,
    },
  });

  return {
    reason: "rate_limited",
    retryAfterMs: delayMs,
    cooldownUntil: cooldownUntil.toISOString(),
  };
}

export async function clearAiSummaryRunnerCooldown(tx: Prisma.TransactionClient, provider: SummaryAiProvider) {
  await tx.aiSummaryRunnerState.deleteMany({
    where: {
      provider,
    },
  });
}

function normalizeSummaryJobBatchLimit(value?: number) {
  if (!Number.isFinite(value)) {
    return DEFAULT_SUMMARY_JOB_BATCH_SIZE;
  }

  const normalized = Math.trunc(value as number);
  if (normalized < 1) {
    throw new RouteError("INVALID_QUERY", 400, '"limit" must be a positive integer.');
  }

  return Math.min(normalized, MAX_SUMMARY_JOB_BATCH_SIZE);
}

function normalizeSummarySweepMaxRuns(value?: number) {
  if (!Number.isFinite(value)) {
    return DEFAULT_SUMMARY_SWEEP_MAX_RUNS;
  }

  const normalized = Math.trunc(value as number);
  if (normalized < 1) {
    throw new RouteError("INVALID_QUERY", 400, '"maxRuns" must be a positive integer.');
  }

  return normalized;
}

function normalizeSummarySweepMaxRuntimeMs(value?: number) {
  if (!Number.isFinite(value)) {
    return DEFAULT_SUMMARY_SWEEP_MAX_RUNTIME_MS;
  }

  const normalized = Math.trunc(value as number);
  if (normalized < 1) {
    throw new RouteError("INVALID_QUERY", 400, '"maxRuntimeMs" must be a positive integer.');
  }

  return normalized;
}

function normalizeAiProvider(value: string | undefined): SummaryAiProvider | null {
  const normalized = value?.trim().toLowerCase();

  if (!normalized) {
    return "gemini";
  }

  if (normalized === "gemini" || normalized === "openai") {
    return normalized;
  }

  return null;
}

function getConfiguredSummaryAiProvider() {
  const provider = normalizeAiProvider(process.env.AI_PROVIDER);
  if (!provider) {
    throw new RouteError("AI_PROVIDER_UNSUPPORTED", 500, 'AI_PROVIDER must be "gemini" or "openai".');
  }

  return provider;
}

function hasAnyInternalAutomationSecret() {
  return Boolean(process.env.INTERNAL_API_SECRET?.trim() || process.env.CRON_SECRET?.trim());
}

async function runNextPendingSummaryJob(options: {
  now: () => number;
  random?: () => number;
}): Promise<SummaryRunNextJobResult> {
  const provider = getConfiguredSummaryAiProvider();
  const lockResult = await withAiSummaryProviderLock(provider, async (tx) => {
    const activeThrottle = getActiveSummaryRunnerThrottle(await getAiSummaryRunnerState(tx, provider), options.now());
    if (activeThrottle) {
      return {
        result: null,
        throttle: activeThrottle,
      };
    }

    const pendingJob = await findNextPendingSummaryJob(tx);
    if (!pendingJob) {
      await clearAiSummaryRunnerCooldown(tx, provider);
      return {
        result: null,
        throttle: null,
      };
    }

    const result = await processSummaryJob(tx, pendingJob);
    if (shouldThrottleSummaryRunner(result)) {
      return {
        result,
        throttle: await applyAiSummaryRunnerCooldown(tx, provider, result.error?.retryAfterMs, options.now(), {
          random: options.random,
        }),
      };
    }

    await clearAiSummaryRunnerCooldown(tx, provider);
    return {
      result,
      throttle: null,
    };
  });

  if (lockResult.status === "runner_busy") {
    return {
      result: null,
      throttle: buildRunnerBusyThrottle(options.random),
    };
  }

  return lockResult.value;
}

async function processSummaryJob(client: SummaryDbClient, job: PendingSummaryJobRecord): Promise<SummaryJobResult> {
  await client.ingestionJob.update({
    where: { id: job.id },
    data: {
      status: IngestionJobStatus.PROCESSING,
      startedAt: job.startedAt ?? new Date(),
      errorMessage: null,
      finishedAt: null,
    },
  });

  if (!job.documentId) {
    return failSummaryJob(client, job.id, null, {
      code: "DOCUMENT_NOT_FOUND",
      message: "Summary job is missing its document reference.",
    });
  }

  const document = await getDocumentByIdWithClient(client, job.documentId);
  if (!document) {
    return failSummaryJob(client, job.id, job.documentId, {
      code: "DOCUMENT_NOT_FOUND",
      message: "Document was not found.",
    });
  }

  if (document.aiSummary) {
    await client.ingestionJob.update({
      where: { id: job.id },
      data: {
        status: IngestionJobStatus.SUCCEEDED,
        finishedAt: new Date(),
        payloadJson: {
          outcome: "skipped",
          reason: "already_summarized",
        },
      },
    });

    return {
      jobId: job.id,
      documentId: document.id,
      outcome: "skipped",
      error: null,
    };
  }

  if (!isEligibleQueuedDocument(document)) {
    const error = {
      code: "DOCUMENT_NOT_READY_FOR_AI_SUMMARY",
      message: "Document is not eligible for automatic AI summary generation.",
    } satisfies GenerateAiSummaryError;

    if (document.aiSummaryStatus === AiSummaryStatus.PENDING) {
      await updateDocumentAiSummaryFailureWithClient(client, document.id, error.message);
    }

    return failSummaryJob(client, job.id, document.id, error);
  }

  try {
    const generated = await generateDocumentAiSummary(document);

    await updateDocumentAiSummaryWithClient(client, document.id, generated.summary);
    await client.ingestionJob.update({
      where: { id: job.id },
      data: {
        status: IngestionJobStatus.SUCCEEDED,
        finishedAt: new Date(),
        payloadJson: {
          outcome: "generated",
          source: generated.source,
        },
      },
    });

    return {
      jobId: job.id,
      documentId: document.id,
      outcome: "generated",
      error: null,
    };
  } catch (error) {
    const summaryError = toGenerateAiSummaryError(error);

    if (isRateLimitedSummaryError(summaryError)) {
      await deferRateLimitedSummaryJob(client, job.id, document.id, summaryError);

      return {
        jobId: job.id,
        documentId: document.id,
        outcome: "deferred",
        error: summaryError,
      };
    }

    await updateDocumentAiSummaryFailureWithClient(client, document.id, summaryError.message);
    return failSummaryJob(client, job.id, document.id, summaryError);
  }
}

async function runPendingSummaryJobForDocument(
  tx: Prisma.TransactionClient,
  provider: SummaryAiProvider,
  documentId: string,
  options: {
    now: () => number;
    random?: () => number;
  },
) {
  const pendingJob = await tx.ingestionJob.findFirst({
    where: {
      kind: IngestionJobKind.GENERATE_AI_SUMMARY,
      documentId,
      status: IngestionJobStatus.PENDING,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  if (!pendingJob) {
    await clearAiSummaryRunnerCooldown(tx, provider);

    return {
      document: await getDocumentByIdWithClient(tx, documentId),
      result: null,
      throttle: null,
    };
  }

  const result = await processSummaryJob(tx, pendingJob);

  if (shouldThrottleSummaryRunner(result)) {
    return {
      document: await getDocumentByIdWithClient(tx, documentId),
      result,
      throttle: await applyAiSummaryRunnerCooldown(tx, provider, result.error?.retryAfterMs, options.now(), {
        random: options.random,
      }),
    };
  }

  await clearAiSummaryRunnerCooldown(tx, provider);

  return {
    document: await getDocumentByIdWithClient(tx, documentId),
    result,
    throttle: null,
  };
}

async function ensurePendingDocumentAiSummaryJob(
  tx: Prisma.TransactionClient,
  document: DocumentDetailRecord,
  options?: { allowRetry?: boolean },
) {
  if (document.aiSummary) {
    return document;
  }

  const shouldQueue = options?.allowRetry
    ? shouldBackfillAutomaticAiSummary(document)
    : shouldEnqueueAutomaticAiSummary(document);

  if (!shouldQueue) {
    return document;
  }

  const existingJob = await tx.ingestionJob.findFirst({
    where: {
      kind: IngestionJobKind.GENERATE_AI_SUMMARY,
      documentId: document.id,
      status: {
        in: [IngestionJobStatus.PENDING, IngestionJobStatus.PROCESSING],
      },
    },
  });

  if (existingJob) {
    return document.aiSummaryStatus === AiSummaryStatus.PENDING
      ? document
      : updateDocumentAiSummaryStateWithClient(tx, document.id, AiSummaryStatus.PENDING);
  }

  if (document.aiSummaryStatus === AiSummaryStatus.PENDING) {
    await tx.ingestionJob.create({
      data: {
        kind: IngestionJobKind.GENERATE_AI_SUMMARY,
        status: IngestionJobStatus.PENDING,
        documentId: document.id,
        sourceUrl: document.sourceUrl ?? document.canonicalUrl,
      },
    });

    return document;
  }

  const pendingDocument = await updateDocumentAiSummaryStateWithClient(tx, document.id, AiSummaryStatus.PENDING);
  await tx.ingestionJob.create({
    data: {
      kind: IngestionJobKind.GENERATE_AI_SUMMARY,
      status: IngestionJobStatus.PENDING,
      documentId: document.id,
      sourceUrl: document.sourceUrl ?? document.canonicalUrl,
    },
  });

  return pendingDocument;
}

async function findNextPendingSummaryJob(client: SummaryDbClient) {
  return client.ingestionJob.findFirst({
    where: {
      kind: IngestionJobKind.GENERATE_AI_SUMMARY,
      status: IngestionJobStatus.PENDING,
    },
    orderBy: {
      createdAt: "asc",
    },
  });
}

async function getDocumentByIdWithClient(client: SummaryDbClient, documentId: string) {
  return client.document.findUnique({
    where: {
      id: documentId,
    },
    ...documentDetailArgs,
  });
}

async function updateDocumentAiSummaryStateWithClient(
  client: SummaryDbClient,
  documentId: string,
  status: AiSummaryStatus,
) {
  return client.document.update({
    where: {
      id: documentId,
    },
    data: {
      aiSummaryStatus: status,
      aiSummaryError: null,
    },
    ...documentDetailArgs,
  });
}

async function updateDocumentAiSummaryWithClient(client: SummaryDbClient, documentId: string, summary: string) {
  return client.document.update({
    where: {
      id: documentId,
    },
    data: {
      aiSummary: summary,
      aiSummaryStatus: AiSummaryStatus.READY,
      aiSummaryError: null,
    },
    ...documentDetailArgs,
  });
}

async function updateDocumentAiSummaryFailureWithClient(
  client: SummaryDbClient,
  documentId: string,
  errorMessage: string,
) {
  return client.document.update({
    where: {
      id: documentId,
    },
    data: {
      aiSummary: null,
      aiSummaryStatus: AiSummaryStatus.FAILED,
      aiSummaryError: errorMessage,
    },
    ...documentDetailArgs,
  });
}

function isEligibleQueuedDocument(document: DocumentDetailRecord) {
  if (document.ingestionStatus !== IngestionStatus.READY) {
    return false;
  }

  return Boolean(normalizeSummarySourceText(document.content?.plainText) || normalizeSummarySourceText(document.excerpt));
}

function normalizeSummarySourceText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function buildSummaryRunResponse(
  results: SummaryJobResult[],
  throttle: SummaryRunnerThrottle | null,
): RunDocumentAiSummaryJobsResponseData {
  return {
    processed: results.length,
    generated: results.filter((result) => result.outcome === "generated").length,
    failed: results.filter((result) => result.outcome === "failed").length,
    skipped: results.filter((result) => result.outcome === "skipped").length,
    deferred: results.filter((result) => result.outcome === "deferred").length,
    throttle,
    results,
  };
}

function buildPrioritizeSummaryResult(
  document: DocumentDetailRecord,
  summary: PrioritizeDocumentAiSummaryResult["summary"],
): PrioritizeDocumentAiSummaryResult {
  return {
    document,
    summary,
  };
}

function shouldThrottleSummaryRunner(result: SummaryJobResult) {
  return result.outcome === "deferred" && isRateLimitedSummaryError(result.error);
}

function getActiveSummaryRunnerThrottle(state: SummaryRunnerStateSnapshot, nowMs: number): SummaryRunnerThrottle | null {
  if (!state.cooldownUntil) {
    return null;
  }

  const remainingMs = state.cooldownUntil.getTime() - nowMs;
  if (remainingMs <= 0) {
    return null;
  }

  return {
    reason: "rate_limited",
    retryAfterMs: remainingMs,
    cooldownUntil: state.cooldownUntil.toISOString(),
  };
}

function buildRunnerBusyThrottle(random?: () => number): SummaryRunnerThrottle {
  return {
    reason: "runner_busy",
    retryAfterMs: resolveRunnerBusyBackoffMs(random),
    cooldownUntil: null,
  };
}

function resolveRunnerBusyBackoffMs(random?: () => number) {
  return SUMMARY_RUNNER_BUSY_MIN_BACKOFF_MS + Math.round((random ?? Math.random)() * SUMMARY_RUNNER_BUSY_BACKOFF_RANGE_MS);
}

function resolveSummaryFairnessGapMs(random?: () => number) {
  return SUMMARY_RUNNER_FAIRNESS_GAP_MIN_MS + Math.round((random ?? Math.random)() * SUMMARY_RUNNER_FAIRNESS_GAP_RANGE_MS);
}

function normalizeRetryAfterMs(value: number | undefined) {
  if (!Number.isFinite(value)) {
    return null;
  }

  return Math.min(Math.max(Math.trunc(value as number), 1_000), MAX_SUMMARY_RATE_LIMIT_COOLDOWN_MS);
}

function isRateLimitedSummaryError(
  error: GenerateAiSummaryError | null,
): error is GenerateAiSummaryError & { code: "AI_PROVIDER_RATE_LIMITED" } {
  return Boolean(error && error.code === "AI_PROVIDER_RATE_LIMITED");
}

async function deferRateLimitedSummaryJob(
  client: SummaryDbClient,
  jobId: string,
  documentId: string,
  error: GenerateAiSummaryError,
) {
  await client.document.update({
    where: {
      id: documentId,
    },
    data: {
      aiSummaryStatus: AiSummaryStatus.PENDING,
      aiSummaryError: null,
    },
  });

  await client.ingestionJob.update({
    where: { id: jobId },
    data: {
      status: IngestionJobStatus.PENDING,
      errorMessage: error.message,
      payloadJson: {
        outcome: "deferred",
        reason: "rate_limited",
        error,
      },
      startedAt: null,
      finishedAt: null,
    },
  });
}

async function failSummaryJob(
  client: SummaryDbClient,
  jobId: string,
  documentId: string | null,
  error: GenerateAiSummaryError,
): Promise<SummaryJobResult> {
  await client.ingestionJob.update({
    where: { id: jobId },
    data: {
      status: IngestionJobStatus.FAILED,
      errorMessage: error.message,
      payloadJson: {
        outcome: "failed",
        error,
      },
      finishedAt: new Date(),
    },
  });

  return {
    jobId,
    documentId,
    outcome: "failed",
    error,
  };
}

function toGenerateAiSummaryError(error: unknown): GenerateAiSummaryError {
  if (error instanceof RouteError) {
    const routeError = error as RouteError & { retryAfterMs?: number };

    return {
      code: routeError.code,
      message: routeError.message,
      ...(routeError.retryAfterMs ? { retryAfterMs: routeError.retryAfterMs } : {}),
    };
  }

  if (error && typeof error === "object" && "message" in error && typeof (error as { message?: unknown }).message === "string") {
    return {
      code: "AI_PROVIDER_REQUEST_FAILED",
      message: (error as { message: string }).message,
    };
  }

  return {
    code: "AI_PROVIDER_REQUEST_FAILED",
    message: "AI summary generation failed.",
  };
}

function sleepForSummarySweep(ms: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}
