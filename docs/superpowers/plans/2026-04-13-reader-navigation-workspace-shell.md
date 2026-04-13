# Reader Navigation Workspace Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current top-toolbar shell with a desktop compact rail plus mobile bottom navigation, while turning search into a triggerable global action and adding the spec-locked reading-page rail weaken state.

**Architecture:** Keep navigation data centralized in `src/lib/product-shell.ts`, move shell orchestration into a dedicated client chrome component, and split desktop rail rendering from mobile bottom navigation rendering. Search remains on the existing quick-search API but becomes a controlled overlay panel, while the reading-page rail weaken behavior is implemented as a separate visual-state system rather than a reused header-hide animation.

**Tech Stack:** Next.js App Router, TypeScript, React client components, Tailwind CSS utility classes, Node test runner with `tsx`

---

## File Map

- `src/lib/product-shell.ts`
  Shared primary-navigation contract and active-state resolution for desktop rail and mobile bottom nav.
- `src/components/layout/navigation-icons.tsx`
  The locked SVG assets from the approved spec. No icon-library imports.
- `src/components/search/global-search.tsx`
  Controlled global-search overlay panel driven by open state instead of a permanently mounted top input.
- `src/components/layout/main-workspace-chrome.tsx`
  Client shell coordinator for search open state, primary navigation items, responsive layout, and rail weaken integration.
- `src/components/layout/navigation-rail.tsx`
  Desktop compact rail renderer with icon-only default state, immediate label pills, and rail weaken visuals.
- `src/components/layout/mobile-bottom-nav.tsx`
  Mobile bottom navigation renderer with icon plus inline small-text labels.
- `src/components/layout/navigation-rail-state.ts`
  Pure helper for deciding when reading pages allow the rail to weaken.
- `src/components/layout/main-header-shell.tsx`
  Simplified page-level header wrapper after the old scroll-hide logic is removed.
- `src/components/layout/header-account-menu.tsx`
  Secondary controls that can report open state back to the rail shell.
- `src/app/(main)/layout.tsx`
  Server layout that delegates shell rendering to the new client chrome.
- `src/lib/product-shell.test.ts`
  Shared nav-contract tests.
- `tests/ui/global-search.test.ts`
  Search entry and panel-structure regression tests.
- `tests/ui/main-header.test.ts`
  Shell-structure regression tests for rail / bottom nav / account placement.
- `src/components/layout/navigation-rail-state.test.ts`
  Pure weaken-state behavior tests.

### Task 1: Lock the primary navigation contract and approved SVG assets

**Files:**
- Create: `src/components/layout/navigation-icons.tsx`
- Modify: `src/lib/product-shell.ts`
- Test: `src/lib/product-shell.test.ts`

- [ ] **Step 1: Write the failing nav-contract tests**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { getPrimaryNavItems } from "./product-shell";

test("primary nav keeps search first and link items in product order", () => {
  const items = getPrimaryNavItems({ pathname: "/sources", searchOpen: false });

  assert.deepEqual(
    items.map((item) => [item.id, item.label, item.href, item.isActive]),
    [
      ["search", "搜索", null, false],
      ["sources", "来源库", "/sources", true],
      ["reading", "Reading", "/reading", false],
      ["highlights", "高亮", "/highlights", false],
    ],
  );
});

test("primary nav marks search active when the search panel is open", () => {
  const items = getPrimaryNavItems({ pathname: "/highlights", searchOpen: true });

  assert.equal(items[0]?.id, "search");
  assert.equal(items[0]?.isActive, true);
  assert.equal(items[3]?.isActive, false);
});
```

- [ ] **Step 2: Run the nav tests and confirm they fail**

Run:

```bash
node --import tsx --test src/lib/product-shell.test.ts
```

Expected: FAIL because `getPrimaryNavItems` does not exist yet.

- [ ] **Step 3: Implement the shared primary-navigation contract in `src/lib/product-shell.ts`**

```ts
export type PrimaryNavItemId = "search" | "sources" | "reading" | "highlights";

export type PrimaryNavItem = {
  id: PrimaryNavItemId;
  label: string;
  href: string | null;
  kind: "action" | "link";
  isActive: boolean;
};

const PRIMARY_NAV_DEFS = [
  { id: "search", label: "搜索", href: null, kind: "action" as const },
  { id: "sources", label: "来源库", href: "/sources", kind: "link" as const },
  { id: "reading", label: "Reading", href: "/reading", kind: "link" as const },
  { id: "highlights", label: "高亮", href: "/highlights", kind: "link" as const },
] as const;

export function getPrimaryNavItems(input: { pathname: string; searchOpen: boolean }): PrimaryNavItem[] {
  return PRIMARY_NAV_DEFS.map((item) => ({
    ...item,
    isActive:
      item.id === "search"
        ? input.searchOpen
        : item.href === "/reading"
          ? input.pathname === "/reading" || input.pathname.startsWith("/documents/")
          : item.href !== null && (input.pathname === item.href || input.pathname.startsWith(`${item.href}/`)),
  }));
}
```

- [ ] **Step 4: Create `src/components/layout/navigation-icons.tsx` with the approved SVG paths exactly as specified**

```tsx
type NavigationIconProps = {
  className?: string;
};

export function SearchNavIcon({ className }: NavigationIconProps) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="9" cy="9" r="5.5" stroke="currentColor" strokeWidth="1.5" />
      <line x1="13.5" y1="13.5" x2="17" y2="17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function SourcesNavIcon({ className }: NavigationIconProps) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="3" y="3" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <rect x="11" y="3" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <rect x="3" y="11" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <rect x="11" y="11" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
```

- [ ] **Step 5: Re-run the nav tests and commit the shared contract**

Run:

```bash
node --import tsx --test src/lib/product-shell.test.ts
```

Expected: PASS

Commit:

```bash
git add src/lib/product-shell.ts src/lib/product-shell.test.ts src/components/layout/navigation-icons.tsx
git commit -m "feat: add shared navigation contract and icons"
```

### Task 2: Turn global search into a controlled overlay panel

**Files:**
- Modify: `src/components/search/global-search.tsx`
- Modify: `tests/ui/global-search.test.ts`

- [ ] **Step 1: Add failing tests for a controlled overlay-based search component**

```ts
test("global search becomes a controlled overlay instead of a permanent top input", () => {
  const component = readWorkspaceFile("src/components/search/global-search.tsx");

  assert.match(component, /type GlobalSearchProps = \{/);
  assert.match(component, /open: boolean/);
  assert.match(component, /onOpenChange: \(open: boolean\) => void/);
  assert.match(component, /fixed inset-0/);
  assert.match(component, /placeholder="搜索文档"/);
  assert.doesNotMatch(component, /min-h-9 rounded-full border-stone-200 bg-white\/80/);
});
```

- [ ] **Step 2: Run the search tests and confirm they fail**

Run:

```bash
node --import tsx --test tests/ui/global-search.test.ts
```

Expected: FAIL because `GlobalSearch` is still the inline header input version.

- [ ] **Step 3: Refactor `GlobalSearch` into a controlled overlay panel**

```tsx
type GlobalSearchProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const trimmedQuery = query.trim();
  const viewAllHref = trimmedQuery ? `/sources?q=${encodeURIComponent(trimmedQuery)}` : "/sources";
  const panelState = resolveGlobalSearchPanelState({
    error,
    isLoading,
    open,
    query,
    resultsCount: results.length,
  });
  const showPanel = panelState.kind !== "closed";

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
    }
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-stone-950/20 backdrop-blur-[2px]" onClick={() => onOpenChange(false)}>
      <div className="mx-auto mt-6 w-full max-w-[42rem] px-4" onClick={(event) => event.stopPropagation()}>
        <div className="overflow-hidden rounded-[28px] border border-[color:var(--border-strong)] bg-[color:var(--bg-surface-strong)] shadow-[var(--shadow-surface)]">
          <form onSubmit={handleSubmit}>
            <TextInput
              id={inputId}
              ref={inputRef}
              className="min-h-12 rounded-none border-0 bg-transparent px-5 text-base"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索文档"
              type="search"
              value={query}
            />
          </form>
          {showPanel ? (
            <div className="border-t border-[color:var(--border-subtle)]">
              <div className="max-h-[26rem] overflow-y-auto p-2">
                {panelState.kind === "loading" ? (
                  <div className="px-4 py-4 text-sm text-[color:var(--text-secondary)]">搜索中…</div>
                ) : panelState.kind === "error" ? (
                  <div className="px-4 py-4 text-sm text-[color:var(--badge-danger-text)]">{panelState.message}</div>
                ) : panelState.kind === "empty" ? (
                  <div className="px-4 py-4 text-sm text-[color:var(--text-secondary)]">{panelState.message}</div>
                ) : (
                  results.map((item, index) => (
                    <button
                      className={cx(
                        "block w-full rounded-[18px] px-4 py-3 text-left transition",
                        index === activeIndex ? "bg-[color:var(--bg-surface-soft)]" : "hover:bg-[color:var(--bg-surface-soft)]",
                      )}
                      key={item.id}
                      onClick={() => navigateToDocument(item.id)}
                      onMouseEnter={() => setActiveIndex(index)}
                      type="button"
                    >
                      <p className="line-clamp-2 text-sm font-medium leading-6 text-[color:var(--text-primary)]">{item.title}</p>
                    </button>
                  ))
                )}
              </div>
              <div className="border-t border-[color:var(--border-subtle)] px-2 py-2">
                <Link
                  className="block rounded-[18px] px-4 py-3 text-sm font-medium text-[color:var(--text-secondary)] transition hover:bg-[color:var(--bg-surface-soft)] hover:text-[color:var(--text-primary)]"
                  href={viewAllHref}
                  onClick={() => onOpenChange(false)}
                >
                  在来源库查看全部结果
                </Link>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Preserve the existing quick-search fetching and keyboard navigation logic inside the overlay**

```tsx
useEffect(() => {
  if (!trimmedQuery) {
    setResults([]);
    setError(null);
    setIsLoading(false);
    setActiveIndex(0);
    return;
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/documents/quick-search?q=${encodeURIComponent(trimmedQuery)}`, {
        signal: controller.signal,
      });
      const payload = (await response.json()) as QuickSearchApiResponse;
      if (!payload.ok) throw new Error(payload.error.message);
      setResults(payload.data.items.slice(0, MAX_RESULTS));
      setActiveIndex(0);
    } catch (fetchError) {
      if (!controller.signal.aborted) {
        setResults([]);
        setError(fetchError instanceof Error ? fetchError.message : "搜索失败，请稍后再试。");
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsLoading(false);
      }
    }
  }, 180);

  return () => {
    controller.abort();
    window.clearTimeout(timeoutId);
  };
}, [trimmedQuery]);
```

- [ ] **Step 5: Re-run the search tests and commit the refactor**

Run:

```bash
node --import tsx --test tests/ui/global-search.test.ts
```

Expected: PASS

Commit:

```bash
git add src/components/search/global-search.tsx tests/ui/global-search.test.ts
git commit -m "feat: make global search a controlled overlay"
```

### Task 3: Build the responsive workspace chrome with desktop rail and mobile bottom nav

**Files:**
- Create: `src/components/layout/main-workspace-chrome.tsx`
- Create: `src/components/layout/navigation-rail.tsx`
- Create: `src/components/layout/mobile-bottom-nav.tsx`
- Modify: `src/app/(main)/layout.tsx`
- Modify: `tests/ui/main-header.test.ts`

- [ ] **Step 1: Add failing shell-structure tests for the new workspace chrome**

```ts
test("main layout delegates shell rendering to the workspace chrome", () => {
  const layout = readWorkspaceFile("src/app/(main)/layout.tsx");
  const chrome = readWorkspaceFile("src/components/layout/main-workspace-chrome.tsx");
  const rail = readWorkspaceFile("src/components/layout/navigation-rail.tsx");
  const bottomNav = readWorkspaceFile("src/components/layout/mobile-bottom-nav.tsx");

  assert.match(layout, /MainWorkspaceChrome/);
  assert.doesNotMatch(layout, /<MainNav/);
  assert.doesNotMatch(layout, /<GlobalSearch/);
  assert.match(chrome, /<NavigationRail/);
  assert.match(chrome, /<MobileBottomNav/);
  assert.match(rail, /HeaderAccountMenu/);
  assert.match(bottomNav, /搜索/);
  assert.match(bottomNav, /Reading/);
});
```

- [ ] **Step 2: Run the shell tests and confirm they fail**

Run:

```bash
node --import tsx --test tests/ui/main-header.test.ts
```

Expected: FAIL because the layout still renders the top nav and inline search directly.

- [ ] **Step 3: Create the new client shell coordinator**

```tsx
"use client";

type MainWorkspaceChromeProps = {
  children: React.ReactNode;
  email: string | null;
};

export function MainWorkspaceChrome({ children, email }: MainWorkspaceChromeProps) {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const items = getPrimaryNavItems({ pathname, searchOpen });

  return (
    <div className="min-h-screen pb-[5.5rem] md:pb-0">
      <div className="md:grid md:grid-cols-[88px_minmax(0,1fr)]">
        <NavigationRail email={email} items={items} onSearchOpen={() => setSearchOpen(true)} />
        <div className="min-w-0">
          <MainHeaderShell>
            <div className="mx-auto flex max-w-[78rem] items-center justify-between px-5 py-3 sm:px-6 lg:px-8">
              <Link className="font-ui-heading text-[1.7rem] leading-none tracking-[-0.06em] md:hidden" href="/sources">
                Reader
              </Link>
              <div className="empty:hidden" id="reader-panel-toggle-slot" />
              <div className="md:hidden">
                <HeaderAccountMenu email={email} />
              </div>
            </div>
          </MainHeaderShell>
          <main className="mx-auto max-w-[78rem] px-5 py-8 sm:px-6 lg:px-8 lg:py-10">{children}</main>
        </div>
      </div>
      <MobileBottomNav items={items} onSearchOpen={() => setSearchOpen(true)} />
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}
```

- [ ] **Step 4: Implement the desktop rail and mobile bottom nav using the shared nav items**

```tsx
export function NavigationRail(props: {
  email: string | null;
  items: PrimaryNavItem[];
  onSearchOpen: () => void;
}) {
  return (
    <aside className="sticky top-0 hidden h-screen border-r border-[color:var(--border-subtle)] bg-[color:var(--bg-header)] md:flex md:flex-col">
      <div className="px-4 pb-6 pt-5">
        <Link className="font-ui-heading text-[1.9rem] tracking-[-0.06em]" href="/sources">
          Reader
        </Link>
      </div>
      <nav className="flex flex-1 flex-col items-center gap-3 px-3">
        {props.items.map((item) =>
          item.kind === "action" ? (
            <button
              aria-label={item.label}
              className="group relative inline-flex min-h-11 w-11 items-center justify-center rounded-[18px] text-[color:var(--text-secondary)] transition hover:bg-[color:var(--bg-surface-soft)] hover:text-[color:var(--text-primary)]"
              key={item.id}
              onClick={props.onSearchOpen}
              type="button"
            >
              <SearchNavIcon />
              <span className="pointer-events-none absolute left-[calc(100%+0.7rem)] rounded-full bg-[color:var(--bg-surface-strong)] px-2.5 py-1 text-xs text-[color:var(--text-primary)] opacity-0 shadow-[var(--shadow-surface)] transition group-hover:opacity-100 group-focus-visible:opacity-100">
                {item.label}
              </span>
            </button>
          ) : (
            <Link
              aria-label={item.label}
              className="group relative inline-flex min-h-11 w-11 items-center justify-center rounded-[18px] transition"
              data-active={item.isActive ? "true" : "false"}
              href={item.href!}
              key={item.id}
            >
              {item.id === "sources" ? <SourcesNavIcon /> : item.id === "reading" ? <ReadingNavIcon /> : <HighlightsNavIcon />}
              <span className="pointer-events-none absolute left-[calc(100%+0.7rem)] rounded-full bg-[color:var(--bg-surface-strong)] px-2.5 py-1 text-xs text-[color:var(--text-primary)] opacity-0 shadow-[var(--shadow-surface)] transition group-hover:opacity-100 group-focus-visible:opacity-100">
                {item.label}
              </span>
            </Link>
          ),
        )}
      </nav>
      <div className="px-3 pb-4">
        <HeaderAccountMenu email={props.email} />
      </div>
    </aside>
  );
}

export function MobileBottomNav(props: {
  items: PrimaryNavItem[];
  onSearchOpen: () => void;
}) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[color:var(--border-subtle)] bg-[color:var(--bg-surface-strong)] px-3 py-2 md:hidden">
      <div className="grid grid-cols-4 gap-2">
        {props.items.map((item) =>
          item.kind === "action" ? (
            <button
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-2 text-[11px] font-medium"
              key={item.id}
              onClick={props.onSearchOpen}
              type="button"
            >
              <SearchNavIcon className="shrink-0" />
              <span className="truncate">{item.label}</span>
            </button>
          ) : (
            <Link
              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full px-2 text-[11px] font-medium"
              href={item.href!}
              key={item.id}
            >
              {item.id === "sources" ? <SourcesNavIcon className="shrink-0" /> : item.id === "reading" ? <ReadingNavIcon className="shrink-0" /> : <HighlightsNavIcon className="shrink-0" />}
              <span className="truncate">{item.label}</span>
            </Link>
          ),
        )}
      </div>
    </nav>
  );
}
```

- [ ] **Step 5: Re-run the shell tests and commit the responsive chrome**

Run:

```bash
node --import tsx --test tests/ui/main-header.test.ts src/lib/product-shell.test.ts
```

Expected: PASS

Commit:

```bash
git add src/app/(main)/layout.tsx src/components/layout/main-workspace-chrome.tsx src/components/layout/navigation-rail.tsx src/components/layout/mobile-bottom-nav.tsx tests/ui/main-header.test.ts
git commit -m "feat: add responsive workspace navigation shell"
```

### Task 4: Implement the reading-page rail weaken state and menu-aware recovery behavior

**Files:**
- Create: `src/components/layout/navigation-rail-state.ts`
- Test: `src/components/layout/navigation-rail-state.test.ts`
- Modify: `src/components/layout/navigation-rail.tsx`
- Modify: `src/components/layout/main-header-shell.tsx`
- Modify: `src/components/layout/header-account-menu.tsx`

- [ ] **Step 1: Write failing tests for rail weaken-state decisions**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { resolveNavigationRailVisualState } from "./navigation-rail-state";

test("only reading pages can enter weakened rail state", () => {
  assert.equal(
    resolveNavigationRailVisualState({
      pathname: "/sources",
      nearTop: false,
      scrollingDown: true,
      searchOpen: false,
      accountMenuOpen: false,
      pointerInside: false,
    }),
    "full",
  );
});

test("reading pages weaken the rail only while scrolling down away from the top", () => {
  assert.equal(
    resolveNavigationRailVisualState({
      pathname: "/documents/doc-123",
      nearTop: false,
      scrollingDown: true,
      searchOpen: false,
      accountMenuOpen: false,
      pointerInside: false,
    }),
    "weakened",
  );

  assert.equal(
    resolveNavigationRailVisualState({
      pathname: "/documents/doc-123",
      nearTop: false,
      scrollingDown: true,
      searchOpen: true,
      accountMenuOpen: false,
      pointerInside: false,
    }),
    "full",
  );
});
```

- [ ] **Step 2: Run the weaken-state tests and confirm they fail**

Run:

```bash
node --import tsx --test src/components/layout/navigation-rail-state.test.ts
```

Expected: FAIL because the helper file does not exist yet.

- [ ] **Step 3: Implement the pure weaken-state helper**

```ts
export type NavigationRailVisualState = "full" | "weakened";

export function resolveNavigationRailVisualState(input: {
  pathname: string;
  nearTop: boolean;
  scrollingDown: boolean;
  searchOpen: boolean;
  accountMenuOpen: boolean;
  pointerInside: boolean;
}): NavigationRailVisualState {
  const isReadingPage = input.pathname.startsWith("/documents/");

  if (!isReadingPage) return "full";
  if (input.nearTop) return "full";
  if (input.searchOpen || input.accountMenuOpen || input.pointerInside) return "full";
  return input.scrollingDown ? "weakened" : "full";
}
```

- [ ] **Step 4: Wire the rail to the spec-locked opacity behavior and add menu open callbacks**

```tsx
type HeaderAccountMenuProps = {
  email: string | null;
  onOpenChange?: (open: boolean) => void;
};

<details
  className="group relative [&_summary::-webkit-details-marker]:hidden"
  onToggle={(event) => props.onOpenChange?.((event.currentTarget as HTMLDetailsElement).open)}
>
```

```tsx
const visualState = resolveNavigationRailVisualState({
  pathname,
  nearTop: window.scrollY < 24,
  scrollingDown: accumulatedDownRef.current > SCROLL_HIDE_THRESHOLD,
  searchOpen,
  accountMenuOpen,
  pointerInside,
});

const railOpacity = pointerInside ? 1 : visualState === "weakened" ? 0.15 : 1;

<aside
  className="sticky top-0 hidden h-screen border-r border-[color:var(--border-subtle)] bg-[color:var(--bg-header)] md:flex md:flex-col"
  onMouseEnter={() => setPointerInside(true)}
  onMouseLeave={() => setPointerInside(false)}
>
  <div aria-hidden="true" className="absolute inset-y-0 left-0 w-[2px] bg-[color:var(--border-subtle)]" />
  <div
    className="flex h-full flex-col transition-opacity ease-out"
    data-rail-visual-state={visualState}
    style={{
      opacity: railOpacity,
      transitionDuration: railOpacity === 1 ? "150ms" : "200ms",
    }}
  >
    <div className="px-4 pb-6 pt-5">
      <Link className="font-ui-heading text-[1.9rem] tracking-[-0.06em]" href="/sources">
        Reader
      </Link>
    </div>
    <nav className="flex flex-1 flex-col items-center gap-3 px-3">
      {items.map((item) =>
        item.kind === "action" ? (
          <button
            aria-label={item.label}
            className="group relative inline-flex min-h-11 w-11 items-center justify-center rounded-[18px] text-[color:var(--text-secondary)] transition hover:bg-[color:var(--bg-surface-soft)] hover:text-[color:var(--text-primary)]"
            key={item.id}
            onClick={onSearchOpen}
            type="button"
          >
            <SearchNavIcon />
            <span className="pointer-events-none absolute left-[calc(100%+0.7rem)] rounded-full bg-[color:var(--bg-surface-strong)] px-2.5 py-1 text-xs text-[color:var(--text-primary)] opacity-0 shadow-[var(--shadow-surface)] transition group-hover:opacity-100 group-focus-visible:opacity-100">
              {item.label}
            </span>
          </button>
        ) : (
          <Link
            aria-label={item.label}
            className="group relative inline-flex min-h-11 w-11 items-center justify-center rounded-[18px] transition"
            data-active={item.isActive ? "true" : "false"}
            href={item.href!}
            key={item.id}
          >
            {item.id === "sources" ? <SourcesNavIcon /> : item.id === "reading" ? <ReadingNavIcon /> : <HighlightsNavIcon />}
            <span className="pointer-events-none absolute left-[calc(100%+0.7rem)] rounded-full bg-[color:var(--bg-surface-strong)] px-2.5 py-1 text-xs text-[color:var(--text-primary)] opacity-0 shadow-[var(--shadow-surface)] transition group-hover:opacity-100 group-focus-visible:opacity-100">
              {item.label}
            </span>
          </Link>
        ),
      )}
    </nav>
    <div className="px-3 pb-4">
      <HeaderAccountMenu email={email} onOpenChange={setAccountMenuOpen} />
    </div>
  </div>
</aside>
```

```tsx
export function MainHeaderShell({ children }: MainHeaderShellProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-[color:var(--border-subtle)] bg-[color:var(--bg-header)] backdrop-blur-xl">
      {children}
    </header>
  );
}
```

- [ ] **Step 5: Re-run the weaken-state and shell tests, then commit**

Run:

```bash
node --import tsx --test src/components/layout/navigation-rail-state.test.ts tests/ui/main-header.test.ts tests/ui/global-search.test.ts
```

Expected: PASS

Commit:

```bash
git add src/components/layout/navigation-rail-state.ts src/components/layout/navigation-rail-state.test.ts src/components/layout/navigation-rail.tsx src/components/layout/main-header-shell.tsx src/components/layout/header-account-menu.tsx
git commit -m "feat: add reading rail weaken state"
```

### Task 5: Run the targeted regression suite and capture final verification

**Files:**
- Modify: `tests/theme/theme-system.test.ts`
- Modify: `tests/ui/main-header.test.ts`
- Modify: `tests/ui/global-search.test.ts`
- Modify: `src/lib/product-shell.test.ts`
- Test: `src/components/layout/navigation-rail-state.test.ts`

- [ ] **Step 1: Add final regression assertions for theme wiring and exact icon usage**

```ts
test("theme system still flows through the workspace shell", () => {
  const mainLayout = readWorkspaceFile("src/app/(main)/layout.tsx");
  const accountMenu = readWorkspaceFile("src/components/layout/header-account-menu.tsx");
  const rail = readWorkspaceFile("src/components/layout/navigation-rail.tsx");

  assert.match(mainLayout, /MainWorkspaceChrome/);
  assert.match(accountMenu, /ThemeToggle/);
  assert.match(rail, /SearchNavIcon/);
  assert.match(rail, /SourcesNavIcon/);
  assert.match(rail, /text-white|data-active=\{item\.isActive \? "true" : "false"\}/);
});
```

- [ ] **Step 2: Run the full targeted regression suite**

Run:

```bash
node --import tsx --test src/lib/product-shell.test.ts src/components/layout/navigation-rail-state.test.ts tests/ui/global-search.test.ts tests/ui/main-header.test.ts tests/theme/theme-system.test.ts
```

Expected: PASS

- [ ] **Step 3: If no dev-server lock is active, run the production build**

Run:

```bash
npm run build:local
```

Expected: Next.js production build completes successfully. If the worktree guard reports an active Reader dev server lock, stop that server first and re-run this command.

- [ ] **Step 4: Create the final feature commit**

```bash
git add src/app/(main)/layout.tsx \
  src/components/layout/main-workspace-chrome.tsx \
  src/components/layout/navigation-rail.tsx \
  src/components/layout/mobile-bottom-nav.tsx \
  src/components/layout/navigation-icons.tsx \
  src/components/layout/navigation-rail-state.ts \
  src/components/layout/navigation-rail-state.test.ts \
  src/components/layout/main-header-shell.tsx \
  src/components/layout/header-account-menu.tsx \
  src/components/search/global-search.tsx \
  src/lib/product-shell.ts \
  src/lib/product-shell.test.ts \
  tests/ui/global-search.test.ts \
  tests/ui/main-header.test.ts \
  tests/theme/theme-system.test.ts
git commit -m "feat: turn reader navigation into workspace shell"
```
