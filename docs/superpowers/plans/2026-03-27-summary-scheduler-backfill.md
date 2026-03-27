# Summary Scheduler And Backfill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make AI summaries run automatically in production and provide a one-time backfill path for existing web documents that are still missing summaries.

**Architecture:** Keep the existing summary worker as the execution core. Add a deployment scheduler that hits the internal worker endpoint, add a second internal endpoint for backfilling eligible documents into the existing queue, and keep both protected by the same internal secret. Do not redesign the document model or summary generation pipeline.

**Tech Stack:** Next.js route handlers, Prisma, Vercel Cron, Node test runner

---

### Task 1: Add failing coverage for backfill selection and internal route semantics

**Files:**
- Modify: `src/server/modules/documents/document-ai-summary-jobs.service.test.ts`

- [ ] **Step 1: Write the failing test for backfill eligibility**

```ts
test("includes ready unsummarized documents in backfill candidates and excludes failed or already summarized documents", () => {
  assert.deepEqual(
    shouldBackfillAutomaticAiSummary({
      ingestionStatus: IngestionStatus.READY,
      aiSummary: null,
      aiSummaryStatus: null,
      excerpt: "A short excerpt.",
      content: {
        plainText: "A full body of text that can be summarized.",
      },
    }),
    true,
  );
});
```

- [ ] **Step 2: Run the targeted test to verify it fails**

Run: `node --import tsx --test src/server/modules/documents/document-ai-summary-jobs.service.test.ts`
Expected: FAIL because `shouldBackfillAutomaticAiSummary` does not exist yet.

- [ ] **Step 3: Write the failing test for previously failed summaries**

```ts
test("includes previously failed summary documents in backfill candidates when content is still eligible", () => {
  assert.equal(
    shouldBackfillAutomaticAiSummary({
      ingestionStatus: IngestionStatus.READY,
      aiSummary: null,
      aiSummaryStatus: AiSummaryStatus.FAILED,
      excerpt: "A short excerpt.",
      content: {
        plainText: "A full body of text that can be summarized.",
      },
    }),
    true,
  );
});
```

- [ ] **Step 4: Run the targeted test to verify it fails**

Run: `node --import tsx --test src/server/modules/documents/document-ai-summary-jobs.service.test.ts`
Expected: FAIL because the backfill predicate is not implemented.

### Task 2: Implement the backfill selector and protected backfill route

**Files:**
- Modify: `src/server/modules/documents/document-ai-summary-jobs.service.ts`
- Create: `src/app/api/internal/summary-jobs/backfill/route.ts`

- [ ] **Step 1: Implement the minimal backfill predicate and batch backfill function**

```ts
export function shouldBackfillAutomaticAiSummary(document: AutoAiSummaryCandidate) {
  if (document.ingestionStatus !== IngestionStatus.READY) {
    return false;
  }

  if (document.aiSummary) {
    return false;
  }

  return Boolean(normalizeSummarySourceText(document.content?.plainText) || normalizeSummarySourceText(document.excerpt));
}
```

- [ ] **Step 2: Add a batch function that queues eligible existing documents**

```ts
export async function backfillAutomaticDocumentAiSummaryJobs(limitInput?: number) {
  const documents = await prisma.document.findMany({
    where: {
      ingestionStatus: IngestionStatus.READY,
      aiSummary: null,
    },
    orderBy: {
      createdAt: "asc",
    },
    take: normalizeSummaryJobBatchLimit(limitInput),
    ...documentDetailArgs,
  });

  // Filter through shouldBackfillAutomaticAiSummary and queueAutomaticDocumentAiSummary
}
```

- [ ] **Step 3: Add the protected internal route**

```ts
export async function POST(request: Request) {
  requireInternalApiAccess(request);
  const limit = parseLimit(new URL(request.url).searchParams.get("limit"));
  return ok(await backfillAutomaticDocumentAiSummaryJobs(limit));
}
```

- [ ] **Step 4: Run the targeted tests to verify they pass**

Run: `node --import tsx --test src/server/modules/documents/document-ai-summary-jobs.service.test.ts`
Expected: PASS

### Task 3: Add deployment scheduler support

**Files:**
- Create: `vercel.json`
- Modify: `README.md`
- Modify: `.env.example`

- [ ] **Step 1: Add the minimal cron config**

```json
{
  "crons": [
    {
      "path": "/api/internal/summary-jobs/run",
      "schedule": "0 * * * *"
    }
  ]
}
```

- [ ] **Step 2: Document the runtime requirement clearly**

```md
- Configure `CRON_SECRET` to match the internal authorization bearer secret used by the worker route.
- Configure one scheduler for `/api/internal/summary-jobs/run`.
- Use `/api/internal/summary-jobs/backfill` only for one-time historical recovery.
```

- [ ] **Step 3: Run a build to verify the deployment config does not break production**

Run: `npm run build`
Expected: PASS

### Task 4: Verify the end-to-end maintenance path

**Files:**
- Reuse existing worker and health routes

- [ ] **Step 1: Verify targeted tests**

Run: `node --import tsx --test src/server/modules/documents/document-ai-summary-jobs.service.test.ts tests/extractors/wechat-extraction.test.ts`
Expected: PASS

- [ ] **Step 2: Verify type safety**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Verify production build**

Run: `npm run build`
Expected: PASS

- [ ] **Step 4: Record follow-up deployment action**

```md
Production still needs:
- `AI_PROVIDER`
- provider API key
- `INTERNAL_API_SECRET`
- `CRON_SECRET`
```
