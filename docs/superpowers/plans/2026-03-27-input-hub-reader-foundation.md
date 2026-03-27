# Input Hub Reader Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reframe Reader as a reading-first input hub by updating the product shell, information architecture, and page scaffolding for the next stage of the product.

**Architecture:** Keep the existing document-centered backend intact and focus this round on product-facing structure. Introduce a shared product-shell config for primary navigation and Library view semantics, then rework app copy and route skeletons around Library, Highlights, Export, and a reading-first Reader.

**Tech Stack:** Next.js App Router, TypeScript, React Server Components, Tailwind CSS, Node test runner with `tsx`

---

### Task 1: Lock the product-shell rules in tests

**Files:**
- Create: `src/lib/product-shell.test.ts`
- Create: `src/lib/product-shell.ts`

- [ ] Add failing tests for primary nav items and Library view state resolution.
- [ ] Run the new test file directly with `node --import tsx --test src/lib/product-shell.test.ts` and confirm it fails because the module does not exist yet.
- [ ] Implement the minimal product-shell helpers.
- [ ] Re-run the test file and confirm it passes.

### Task 2: Reframe the app shell and Library around the new product model

**Files:**
- Modify: `src/app/(main)/layout.tsx`
- Modify: `src/components/layout/main-nav.tsx`
- Modify: `src/app/(main)/library/page.tsx`
- Modify: `src/components/library/capture-url-form.tsx`

- [ ] Wire the main nav to the shared product-shell config.
- [ ] Update Library header copy to “personal input hub” semantics.
- [ ] Add Library view pills for `Inbox`, `Later`, `Starred`, and `Archive`.
- [ ] Keep existing query/filter behavior intact while preserving search and sort params.

### Task 3: Add real page skeletons for Highlights and Export

**Files:**
- Create: `src/app/(main)/highlights/page.tsx`
- Create: `src/app/(main)/export/page.tsx`

- [ ] Add a Highlights route with a valid empty-state product surface, not a “coming soon” placeholder.
- [ ] Add an Export route that frames Obsidian as the downstream destination without pretending the export engine already exists.
- [ ] Make both pages feel like intentional product surfaces and link users back into the current reading flow.

### Task 4: Tighten Reader and authentication copy around the new positioning

**Files:**
- Modify: `src/components/reader/document-reader.tsx`
- Modify: `src/app/login/page.tsx`
- Modify: `README.md`

- [ ] Update Reader support copy so it reads like a reading product, not an archive admin tool.
- [ ] Update login copy to match the “private input hub” framing.
- [ ] Refresh README with the new positioning, boundaries, and next-stage information architecture.

### Task 5: Verify the foundation

**Files:**
- Test: `src/lib/product-shell.test.ts`

- [ ] Run `node --import tsx --test src/lib/product-shell.test.ts`.
- [ ] Run `npx tsc --noEmit`.
- [ ] Run `npm run build`.
- [ ] Confirm that the new routes and shell compile without breaking the authenticated app flow.
