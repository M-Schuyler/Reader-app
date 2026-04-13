"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { HeaderAccountMenu } from "@/components/layout/header-account-menu";
import { HighlightsNavIcon, ReadingNavIcon, SearchNavIcon, SourcesNavIcon } from "@/components/layout/navigation-icons";
import { resolveNavigationRailVisualState } from "@/components/layout/navigation-rail-state";
import type { PrimaryNavItem } from "@/lib/product-shell";
import { cx } from "@/utils/cx";

const SCROLL_HIDE_THRESHOLD = 20;
const SCROLL_JITTER_THRESHOLD = 8;
const RAIL_NEAR_TOP_THRESHOLD = 24;

type NavigationRailProps = {
  email: string | null;
  items: PrimaryNavItem[];
  onSearchOpen: () => void;
  searchOpen: boolean;
};

export function NavigationRail({ email, items, onSearchOpen, searchOpen }: NavigationRailProps) {
  const pathname = usePathname();
  const previousScrollYRef = useRef(0);
  const accumulatedDownRef = useRef(0);
  const [nearTop, setNearTop] = useState(true);
  const [scrollingDown, setScrollingDown] = useState(false);
  const [pointerInside, setPointerInside] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

  useEffect(() => {
    const initialScrollY = window.scrollY;
    previousScrollYRef.current = initialScrollY;
    accumulatedDownRef.current = 0;
    setNearTop(initialScrollY < RAIL_NEAR_TOP_THRESHOLD);
    setScrollingDown(false);
  }, [pathname]);

  useEffect(() => {
    function handleScroll() {
      const currentScrollY = window.scrollY;
      const delta = currentScrollY - previousScrollYRef.current;
      previousScrollYRef.current = currentScrollY;

      const nextNearTop = currentScrollY < RAIL_NEAR_TOP_THRESHOLD;
      setNearTop(nextNearTop);
      if (nextNearTop) {
        accumulatedDownRef.current = 0;
        setScrollingDown(false);
        return;
      }

      if (delta > SCROLL_JITTER_THRESHOLD) {
        accumulatedDownRef.current += delta;
        if (accumulatedDownRef.current > SCROLL_HIDE_THRESHOLD) {
          setScrollingDown(true);
        }
        return;
      }

      if (delta < 0) {
        accumulatedDownRef.current = 0;
        setScrollingDown(false);
      }
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const visualState = resolveNavigationRailVisualState({
    pathname,
    nearTop,
    scrollingDown,
    searchOpen,
    accountMenuOpen,
    pointerInside,
  });
  const railOpacity = pointerInside ? 1 : visualState === "weakened" ? 0.15 : 1;

  return (
    <aside
      className="relative sticky top-0 z-20 hidden h-screen border-r border-[color:var(--border-subtle)] bg-[color:var(--bg-header)] md:flex md:flex-col"
      onMouseEnter={() => setPointerInside(true)}
      onMouseLeave={() => setPointerInside(false)}
    >
      <div
        className="flex h-full flex-col transition-opacity ease-out"
        data-rail-visual-state={visualState}
        style={{
          opacity: railOpacity,
          transitionDuration: railOpacity === 1 ? "150ms" : "200ms",
        }}
      >
        <div className="px-3 pb-6 pt-5">
          <Link
            className="inline-flex w-full items-center justify-center font-ui-heading text-[1.05rem] leading-none tracking-[-0.01em] text-[color:var(--text-primary-strong)]"
            href="/sources"
          >
            Reader
          </Link>
        </div>

        <nav className="flex flex-1 flex-col items-center gap-3 px-3">
          {items.map((item) => {
            const baseClass =
              "group relative inline-flex min-h-11 w-11 items-center justify-center rounded-[18px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--border-strong)]";
            const stateClass = item.isActive
              ? "bg-stone-900 !text-white"
              : "text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-surface-soft)] hover:text-[color:var(--text-primary)]";

            if (item.kind === "action") {
              return (
                <button
                  aria-label={item.label}
                  className={cx(baseClass, stateClass)}
                  data-active={item.isActive ? "true" : "false"}
                  key={item.id}
                  onClick={onSearchOpen}
                  type="button"
                >
                  <SearchNavIcon className="h-5 w-5" />
                  <span className="pointer-events-none absolute left-[calc(100%+0.7rem)] rounded-full bg-[color:var(--bg-surface-strong)] px-2.5 py-1 text-xs text-[color:var(--text-primary)] opacity-0 shadow-[var(--shadow-surface)] transition-opacity duration-150 ease-out group-hover:opacity-100 group-focus-visible:opacity-100">
                    {item.label}
                  </span>
                </button>
              );
            }

            return (
              <Link
                aria-label={item.label}
                className={cx(baseClass, stateClass)}
                data-active={item.isActive ? "true" : "false"}
                href={item.href ?? "/sources"}
                key={item.id}
              >
                {resolvePrimaryNavIcon(item.id)}
                <span className="pointer-events-none absolute left-[calc(100%+0.7rem)] rounded-full bg-[color:var(--bg-surface-strong)] px-2.5 py-1 text-xs text-[color:var(--text-primary)] opacity-0 shadow-[var(--shadow-surface)] transition-opacity duration-150 ease-out group-hover:opacity-100 group-focus-visible:opacity-100">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="flex justify-center pb-4">
          <HeaderAccountMenu
            email={email}
            onOpenChange={setAccountMenuOpen}
            panelHorizontal="outside-right"
            panelPlacement="up"
          />
        </div>
      </div>
    </aside>
  );
}

function resolvePrimaryNavIcon(id: PrimaryNavItem["id"]) {
  if (id === "sources") {
    return <SourcesNavIcon className="h-5 w-5" />;
  }

  if (id === "reading") {
    return <ReadingNavIcon className="h-5 w-5" />;
  }

  return <HighlightsNavIcon className="h-5 w-5" />;
}
