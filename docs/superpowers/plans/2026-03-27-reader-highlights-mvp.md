# Reader Highlights MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reading-first highlight and light annotation flow inside Reader so a document can move from “readable” to “marked and revisitable” without turning Reader into a full notes system.

**Architecture:** Keep the existing `Highlight` Prisma model and build a narrow vertical slice: server-side CRUD for highlights, client-side selection capture and anchored rendering, and a small highlight list for note editing. Anchor persistence will use `quoteText` plus optional `startOffset`, `endOffset`, and minimal `selectorJson` so the Reader can restore highlights without depending on experimental browser highlight APIs.

**Tech Stack:** Next.js App Router, TypeScript, React client components, Prisma, Node test runner with `tsx`

---

### Task 1: Define the highlight contract and server behavior

**Files:**
- Create: `src/server/modules/highlights/highlight.types.ts`
- Create: `src/server/modules/highlights/highlight.repository.ts`
- Create: `src/server/modules/highlights/highlight.service.ts`
- Test: `src/server/modules/highlights/highlight.service.test.ts`

- [ ] **Step 1: Write failing tests for highlight payload parsing and eligibility**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { parseCreateHighlightInput, shouldAllowHighlightCreation } from "./highlight.service";

test("parses create highlight input with quote and offsets", () => {
  const input = parseCreateHighlightInput({
    quoteText: "Important sentence",
    startOffset: 32,
    endOffset: 50,
    selectorJson: { exact: "Important sentence" },
  });

  assert.equal(input.quoteText, "Important sentence");
  assert.equal(input.startOffset, 32);
  assert.equal(input.endOffset, 50);
});

test("rejects empty quote text", () => {
  assert.throws(() => parseCreateHighlightInput({ quoteText: "   " }), /quoteText/i);
});

test("allows highlight creation only for readable documents", () => {
  assert.equal(shouldAllowHighlightCreation({ ingestionStatus: "READY", hasContent: true }), true);
  assert.equal(shouldAllowHighlightCreation({ ingestionStatus: "FAILED", hasContent: false }), false);
});
```

- [ ] **Step 2: Run the new test file and confirm it fails**

Run:

```bash
node --import tsx --test src/server/modules/highlights/highlight.service.test.ts
```

Expected: fail because the service module and functions do not exist yet.

- [ ] **Step 3: Implement the minimal types and service helpers**

```ts
export type HighlightRecord = {
  id: string;
  documentId: string;
  quoteText: string;
  note: string | null;
  color: string | null;
  startOffset: number | null;
  endOffset: number | null;
  selectorJson: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export function shouldAllowHighlightCreation(input: {
  ingestionStatus: "READY" | "FAILED" | "PENDING" | "PROCESSING";
  hasContent: boolean;
}) {
  return input.ingestionStatus === "READY" && input.hasContent;
}
```

- [ ] **Step 4: Add repository functions using the existing Prisma model**

```ts
export async function listHighlightsByDocumentId(documentId: string) {
  return prisma.highlight.findMany({
    where: { documentId },
    orderBy: { createdAt: "asc" },
  });
}

export async function createHighlight(input: Prisma.HighlightUncheckedCreateInput) {
  return prisma.highlight.create({ data: input });
}

export async function updateHighlight(id: string, data: Prisma.HighlightUpdateInput) {
  return prisma.highlight.update({ where: { id }, data });
}

export async function deleteHighlight(id: string) {
  return prisma.highlight.delete({ where: { id } });
}
```

- [ ] **Step 5: Re-run the service tests and confirm they pass**

Run:

```bash
node --import tsx --test src/server/modules/highlights/highlight.service.test.ts
```

Expected: PASS

### Task 2: Expose highlight CRUD through authenticated API routes

**Files:**
- Create: `src/app/api/documents/[id]/highlights/route.ts`
- Create: `src/app/api/highlights/[id]/route.ts`
- Modify: `src/server/modules/highlights/highlight.service.ts`
- Test: `src/server/modules/highlights/highlight.service.test.ts`

- [ ] **Step 1: Add failing tests for route-facing parse helpers**

```ts
test("parses highlight note updates", () => {
  const input = parseUpdateHighlightInput({ note: "Keep this for export." });
  assert.equal(input.note, "Keep this for export.");
});

test("rejects invalid offset ranges", () => {
  assert.throws(
    () => parseCreateHighlightInput({ quoteText: "Bad", startOffset: 20, endOffset: 10 }),
    /offset/i,
  );
});
```

- [ ] **Step 2: Run tests to confirm the new cases fail**

Run:

```bash
node --import tsx --test src/server/modules/highlights/highlight.service.test.ts
```

Expected: FAIL with missing parser behavior.

- [ ] **Step 3: Implement service entry points and parsers**

```ts
export async function getDocumentHighlights(documentId: string) {
  return { items: (await listHighlightsByDocumentId(documentId)).map(mapHighlightRecord) };
}

export async function addDocumentHighlight(documentId: string, input: CreateHighlightInput) {
  const document = await getDocumentById(documentId);
  if (!document) return null;

  if (!shouldAllowHighlightCreation({
    ingestionStatus: document.ingestionStatus,
    hasContent: Boolean(document.content?.plainText?.trim() || document.content?.contentHtml?.trim()),
  })) {
    throw new RouteError("DOCUMENT_NOT_HIGHLIGHTABLE", 409, "Highlights are only available for readable documents.");
  }

  return { highlight: mapHighlightRecord(await createHighlight({ documentId, ...input })) };
}
```

- [ ] **Step 4: Add authenticated routes using the existing API response helpers**

```ts
export async function GET(_: Request, context: RouteContext) {
  await requireApiUser();
  const { id } = await context.params;
  return ok(await getDocumentHighlights(id));
}

export async function POST(request: Request, context: RouteContext) {
  await requireApiUser();
  const { id } = await context.params;
  const payload = parseCreateHighlightInput(await request.json());
  const data = await addDocumentHighlight(id, payload);
  if (!data) throw new RouteError("DOCUMENT_NOT_FOUND", 404, "Document was not found.");
  return ok(data, { status: 201 });
}
```

- [ ] **Step 5: Re-run the service tests**

Run:

```bash
node --import tsx --test src/server/modules/highlights/highlight.service.test.ts
```

Expected: PASS

### Task 3: Add client-side anchor calculation and highlight rendering helpers

**Files:**
- Create: `src/lib/highlights/anchor.ts`
- Create: `src/lib/highlights/anchor.test.ts`
- Modify: `src/components/reader/reader-rich-content.tsx`

- [ ] **Step 1: Write failing tests for text anchor extraction and segment rendering**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { buildTextAnchor, splitTextByHighlights } from "./anchor";

test("builds offsets from a selected substring", () => {
  const anchor = buildTextAnchor("Alpha beta gamma", 6, 10);
  assert.equal(anchor.quoteText, "beta");
  assert.equal(anchor.startOffset, 6);
  assert.equal(anchor.endOffset, 10);
});

test("splits plain text around highlight ranges", () => {
  const segments = splitTextByHighlights("Alpha beta gamma", [
    { id: "h1", startOffset: 6, endOffset: 10, quoteText: "beta" },
  ]);

  assert.deepEqual(segments.map((segment) => segment.type), ["text", "highlight", "text"]);
});
```

- [ ] **Step 2: Run the anchor tests and confirm they fail**

Run:

```bash
node --import tsx --test src/lib/highlights/anchor.test.ts
```

Expected: FAIL because the module does not exist yet.

- [ ] **Step 3: Implement minimal offset helpers**

```ts
export function buildTextAnchor(sourceText: string, startOffset: number, endOffset: number) {
  return {
    quoteText: sourceText.slice(startOffset, endOffset),
    startOffset,
    endOffset,
    selectorJson: null,
  };
}
```

- [ ] **Step 4: Extend `ReaderRichContent` with optional highlight data and plain-text fallback rendering**

```tsx
type ReaderRichContentProps = {
  contentHtml: string;
  fallbackText: string;
  sourceUrl: string | null;
  highlights?: ReaderHighlight[];
};

if (!content) {
  return (
    <div className="reader-prose">
      {renderPlainTextWithHighlights(fallbackText, highlights)}
    </div>
  );
}
```

- [ ] **Step 5: Re-run the anchor tests**

Run:

```bash
node --import tsx --test src/lib/highlights/anchor.test.ts
```

Expected: PASS

### Task 4: Add Reader-side highlight creation, note editing, and display

**Files:**
- Create: `src/components/reader/reader-highlights.tsx`
- Modify: `src/components/reader/document-reader.tsx`
- Modify: `src/components/reader/reader-rich-content.tsx`

- [ ] **Step 1: Add a client component shell that loads, creates, updates, and deletes highlights**

```tsx
type ReaderHighlightsProps = {
  documentId: string;
  sourceText: string;
  highlights: ReaderHighlight[];
  canHighlight: boolean;
};

export function ReaderHighlights(props: ReaderHighlightsProps) {
  const [highlights, setHighlights] = useState(props.highlights);
  // selection capture, optimistic creation, note edits, delete
}
```

- [ ] **Step 2: Add a minimal selection affordance**

```tsx
{selectionDraft ? (
  <div className="fixed bottom-6 left-1/2 z-20 -translate-x-1/2">
    <button onClick={createHighlightFromSelection}>Save highlight</button>
  </div>
) : null}
```

- [ ] **Step 3: Render highlights inside Reader without overpowering the page**

```tsx
<ReaderRichContent
  contentHtml={contentHtml}
  fallbackText={plainText}
  highlights={highlights}
  sourceUrl={sourceUrl}
/>
```

- [ ] **Step 4: Add a lightweight side panel list for highlight notes**

```tsx
<section>
  <h3>Highlights</h3>
  {highlights.map((highlight) => (
    <article key={highlight.id}>
      <blockquote>{highlight.quoteText}</blockquote>
      <textarea value={highlight.note ?? ""} />
    </article>
  ))}
</section>
```

- [ ] **Step 5: Keep the MVP narrow**

Do not add:

```text
- multi-color highlight taxonomy
- rich text notes
- tag editing inside highlight cards
- cross-document highlight management
- export wiring
```

### Task 5: Verify the full highlight MVP

**Files:**
- Test: `src/server/modules/highlights/highlight.service.test.ts`
- Test: `src/lib/highlights/anchor.test.ts`

- [ ] **Step 1: Run the highlight service tests**

Run:

```bash
node --import tsx --test src/server/modules/highlights/highlight.service.test.ts
```

Expected: PASS

- [ ] **Step 2: Run the anchor tests**

Run:

```bash
node --import tsx --test src/lib/highlights/anchor.test.ts
```

Expected: PASS

- [ ] **Step 3: Run typecheck**

Run:

```bash
npx tsc --noEmit
```

Expected: PASS

- [ ] **Step 4: Run production build**

Run:

```bash
npm run build
```

Expected: PASS with new highlight routes and Reader components included in the build.

- [ ] **Step 5: Manual acceptance**

Verify in the browser:

```text
1. Open a readable document in /documents/[id]
2. Select text and create a highlight
3. Refresh the page and confirm the highlight reappears
4. Add a short note to the highlight
5. Delete the highlight and confirm it disappears
6. Confirm FAILED documents do not expose highlight creation
```
