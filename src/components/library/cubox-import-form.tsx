"use client";

import Link from "next/link";
import { type FormEvent, useEffect, useRef, useState } from "react";
import type { ApiError, ApiSuccess } from "@/server/api/response";
import type { SweepDocumentAiSummaryJobsResponseData } from "@/server/modules/documents/document.types";
import type { CuboxImportBatchResult } from "@/server/modules/imports/cubox";
import { Button } from "@/components/ui/button";
import { Field, TextInput } from "@/components/ui/form-controls";
import { Panel } from "@/components/ui/panel";

type CuboxImportApiResponse = ApiSuccess<CuboxImportBatchResult> | ApiError;
type SummaryJobsApiResponse = ApiSuccess<SweepDocumentAiSummaryJobsResponseData> | ApiError;
type ImportPhase = "idle" | "importing" | "summarizing" | "done";

type ImportProgress = {
  batches: number;
  imported: number;
  updated: number;
  skipped: number;
  failed: number;
  summaryQueued: number;
  summaryProcessed: number;
  summaryGenerated: number;
  summaryFailed: number;
  summarySkipped: number;
  summaryRuntimeIssues: string[];
  errors: Array<{ cardId: string; message: string }>;
};

const INITIAL_PROGRESS: ImportProgress = {
  batches: 0,
  imported: 0,
  updated: 0,
  skipped: 0,
  failed: 0,
  summaryQueued: 0,
  summaryProcessed: 0,
  summaryGenerated: 0,
  summaryFailed: 0,
  summarySkipped: 0,
  summaryRuntimeIssues: [],
  errors: [],
};

export function CuboxImportForm() {
  const [apiLink, setApiLink] = useState("");
  const [phase, setPhase] = useState<ImportPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ImportProgress>(INITIAL_PROGRESS);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const isActiveRef = useRef(true);
  const isWorking = phase === "importing" || phase === "summarizing";

  useEffect(() => {
    return () => {
      isActiveRef.current = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedApiLink = apiLink.trim();
    if (!normalizedApiLink) {
      return;
    }

    setError(null);
    setStatusMessage("正在从 Cubox 拉取内容。");
    setProgress(INITIAL_PROGRESS);
    setPhase("importing");

    let cursor: CuboxImportBatchResult["nextCursor"] = null;
    let nextProgress: ImportProgress = INITIAL_PROGRESS;

    try {
      while (isActiveRef.current) {
        const batch = await importCuboxBatch({
          apiLink: normalizedApiLink,
          cursor,
          limit: 20,
        });

        nextProgress = {
          ...nextProgress,
          batches: nextProgress.batches + 1,
          imported: nextProgress.imported + batch.imported,
          updated: nextProgress.updated + batch.updated,
          skipped: nextProgress.skipped + batch.skipped,
          failed: nextProgress.failed + batch.failed,
          summaryQueued: nextProgress.summaryQueued + batch.summaryQueued,
          summaryRuntimeIssues:
            batch.summaryRuntimeIssues.length > 0 ? batch.summaryRuntimeIssues : nextProgress.summaryRuntimeIssues,
          errors: [...nextProgress.errors, ...batch.errors].slice(-12),
        };
        setProgress(nextProgress);

        if (!batch.hasMore || !batch.nextCursor) {
          break;
        }

        cursor = batch.nextCursor;
      }

      if (!isActiveRef.current) {
        return;
      }

      if (nextProgress.summaryRuntimeIssues.length > 0) {
        setPhase("done");
        setStatusMessage("内容已经导入，但摘要环境还没准备好，所以这轮不会自动生成摘要。");
        return;
      }

      if (nextProgress.summaryQueued === 0) {
        setPhase("done");
        setStatusMessage("导入完成。这一轮没有新的摘要任务需要处理。");
        return;
      }

      setPhase("summarizing");
      setStatusMessage("正文已经入库，正在跑摘要队列。");

      while (isActiveRef.current) {
        const summaryRun = await runSummarySweep();
        nextProgress = {
          ...nextProgress,
          summaryProcessed: nextProgress.summaryProcessed + summaryRun.processed,
          summaryGenerated: nextProgress.summaryGenerated + summaryRun.generated,
          summaryFailed: nextProgress.summaryFailed + summaryRun.failed,
          summarySkipped: nextProgress.summarySkipped + summaryRun.skipped,
        };
        setProgress(nextProgress);

        if (summaryRun.throttle?.reason === "rate_limited") {
          const retryAfterMs = Math.max(summaryRun.throttle.retryAfterMs, 1_000);
          setStatusMessage(`AI 服务开始限流，Reader 会自动降速，约 ${formatDuration(retryAfterMs)} 后继续。`);
          await sleep(retryAfterMs);

          if (!isActiveRef.current) {
            return;
          }

          setStatusMessage("限流窗口已过，继续跑摘要队列。");
          continue;
        }

        if (summaryRun.throttle?.reason === "runner_busy") {
          const retryAfterMs = Math.max(summaryRun.throttle.retryAfterMs, 1_000);
          setStatusMessage(`另一条摘要 runner 正在占用 provider 通道，Reader 会在约 ${formatDuration(retryAfterMs)} 后继续。`);
          await sleep(retryAfterMs);

          if (!isActiveRef.current) {
            return;
          }

          setStatusMessage("provider 通道已经空出来，继续跑摘要队列。");
          continue;
        }

        if (summaryRun.completed) {
          break;
        }

        setStatusMessage("这一轮摘要清队已经吃满当前预算，马上继续下一轮。");
      }

      if (!isActiveRef.current) {
        return;
      }

      setPhase("done");
      setStatusMessage("Cubox 内容已经迁进 Reader，摘要队列也跑完了当前可处理的任务。");
    } catch (submitError) {
      if (!isActiveRef.current) {
        return;
      }

      setPhase("done");
      setError(resolveImportErrorMessage(submitError));
      setStatusMessage(null);
    }
  }

  return (
    <div className="space-y-6">
      <Panel className="space-y-5">
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <h2 className="font-ui-heading text-[1.6rem] leading-tight tracking-[-0.03em] text-[color:var(--text-primary)]">
              一次性迁入 Cubox
            </h2>
            <p className="max-w-2xl text-sm leading-7 text-[color:var(--text-secondary)]">
              API link 只会在本次导入请求里使用，不会写进数据库，也不会保存在 Reader 里。页面会先主动清一轮摘要队列；线上环境后续会交给后台慢慢续跑，本地开发环境离开页面后不会自己继续。
            </p>
          </div>

          <Field label="Cubox API link">
            <TextInput
              autoComplete="off"
              className="min-h-11 rounded-[18px]"
              onChange={(event) => setApiLink(event.target.value)}
              placeholder="https://cubox.pro/c/api/save/..."
              type="url"
              value={apiLink}
            />
          </Field>

          <div className="flex flex-wrap items-center gap-3">
            <Button disabled={isWorking || !apiLink.trim()} type="submit" variant="primary">
              {phase === "importing" ? "导入中…" : phase === "summarizing" ? "生成摘要中…" : "开始导入"}
            </Button>
            <Link
              className="text-sm font-medium text-[color:var(--text-secondary)] transition hover:text-[color:var(--text-primary)]"
              href="/sources"
            >
              返回来源库
            </Link>
          </div>
        </form>
      </Panel>

      <Panel className="space-y-5" tone="muted">
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[color:var(--text-tertiary)]">导入状态</p>
          <h3 className="font-ui-heading text-[1.4rem] leading-tight tracking-[-0.03em] text-[color:var(--text-primary)]">
            {formatPhaseLabel(phase)}
          </h3>
          {statusMessage ? <p className="text-sm leading-7 text-[color:var(--text-secondary)]">{statusMessage}</p> : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="批次" value={String(progress.batches)} />
          <MetricCard label="新导入" value={String(progress.imported)} />
          <MetricCard label="已更新" value={String(progress.updated)} />
          <MetricCard label="跳过" value={String(progress.skipped)} />
          <MetricCard label="失败" value={String(progress.failed)} />
          <MetricCard label="摘要排队" value={String(progress.summaryQueued)} />
          <MetricCard label="摘要已生成" value={String(progress.summaryGenerated)} />
          <MetricCard label="摘要失败/跳过" value={`${progress.summaryFailed}/${progress.summarySkipped}`} />
        </div>

        {error ? (
          <p className="rounded-[18px] border border-[color:var(--badge-danger-bg)] bg-[color:var(--badge-danger-bg)] px-4 py-3 text-sm text-[color:var(--badge-danger-text)]">
            {error}
          </p>
        ) : null}

        {progress.summaryRuntimeIssues.length > 0 ? (
          <div className="space-y-2 rounded-[20px] border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] px-4 py-4">
            <p className="text-sm font-medium text-[color:var(--text-primary)]">摘要没有自动跑起来</p>
            <div className="space-y-1.5 text-sm leading-6 text-[color:var(--text-secondary)]">
              {progress.summaryRuntimeIssues.map((issue) => (
                <p key={issue}>{localizeSummaryRuntimeIssue(issue)}</p>
              ))}
            </div>
          </div>
        ) : null}

        {progress.errors.length > 0 ? (
          <div className="space-y-2 rounded-[20px] border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] px-4 py-4">
            <p className="text-sm font-medium text-[color:var(--text-primary)]">最近失败的条目</p>
            <ul className="space-y-2 text-sm leading-6 text-[color:var(--text-secondary)]">
              {progress.errors.map((entry) => (
                <li key={`${entry.cardId}:${entry.message}`}>
                  <span className="font-mono text-[color:var(--text-tertiary)]">{entry.cardId}</span>
                  <span className="mx-2">·</span>
                  <span>{entry.message}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </Panel>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] px-4 py-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[color:var(--text-tertiary)]">{label}</p>
      <p className="mt-3 font-ui-heading text-[1.8rem] leading-none tracking-[-0.04em] text-[color:var(--text-primary)]">
        {value}
      </p>
    </div>
  );
}

async function importCuboxBatch(input: {
  apiLink: string;
  cursor: CuboxImportBatchResult["nextCursor"];
  limit: number;
}) {
  const response = await fetch("/api/imports/cubox", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(input),
  });
  const payload = (await response.json()) as CuboxImportApiResponse;

  if (!payload.ok) {
    throw new Error(localizeApiError(payload.error.code));
  }

  return payload.data;
}

async function runSummarySweep() {
  const response = await fetch("/api/internal/summary-jobs/sweep?limit=5&maxRuns=6&maxRuntimeMs=45000", {
    method: "POST",
  });
  const payload = (await response.json()) as SummaryJobsApiResponse;

  if (!payload.ok) {
    throw new Error("摘要队列启动失败，请稍后再试。");
  }

  return payload.data;
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function formatPhaseLabel(phase: ImportPhase) {
  switch (phase) {
    case "importing":
      return "正在导入正文";
    case "summarizing":
      return "正在生成摘要";
    case "done":
      return "本轮处理完成";
    case "idle":
    default:
      return "等待开始";
  }
}

function formatDuration(ms: number) {
  const seconds = Math.max(1, Math.ceil(ms / 1_000));

  if (seconds < 60) {
    return `${seconds} 秒`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds === 0 ? `${minutes} 分钟` : `${minutes} 分 ${remainingSeconds} 秒`;
}

function resolveImportErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return "Cubox 导入失败，请稍后再试。";
}

function localizeApiError(code: string) {
  switch (code) {
    case "INVALID_CUBOX_API_LINK":
      return "Cubox API link 不对，请检查后再试。";
    case "UNAUTHORIZED":
      return "你还没登录，先登录再导入。";
    case "CUBOX_API_UNAVAILABLE":
    case "CUBOX_API_REJECTED":
    case "CUBOX_API_INVALID_RESPONSE":
      return "Reader 现在没能从 Cubox 读到数据，请稍后重试。";
    default:
      return "Cubox 导入失败，请稍后再试。";
  }
}

function localizeSummaryRuntimeIssue(issue: string) {
  if (issue.includes("AI_PROVIDER")) {
    return "AI_PROVIDER 还没配好，目前不能自动生成摘要。";
  }

  if (issue.includes("OPENAI_API_KEY")) {
    return "OPENAI_API_KEY 还没配置，所以这轮不会自动生成摘要。";
  }

  if (issue.includes("GEMINI_API_KEY")) {
    return "GEMINI_API_KEY 还没配置，所以这轮不会自动生成摘要。";
  }

  if (issue.includes("INTERNAL_API_SECRET") || issue.includes("CRON_SECRET")) {
    return "内部自动任务密钥还没配置，摘要队列现在跑不起来。";
  }

  return issue;
}
