"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { cx } from "@/utils/cx";

type MainHeaderShellProps = {
  children: ReactNode;
};

const SCROLL_HIDE_THRESHOLD = 10;
const SCROLL_JITTER_THRESHOLD = 8;

export function MainHeaderShell({ children }: MainHeaderShellProps) {
  const pathname = usePathname();
  const [isHidden, setIsHidden] = useState(false);
  const previousScrollYRef = useRef(0);
  const accumulatedDownRef = useRef(0);
  const isDocumentReadingPage = pathname.startsWith("/documents/");

  useEffect(() => {
    setIsHidden(false);
    accumulatedDownRef.current = 0;
    previousScrollYRef.current = window.scrollY;
  }, [pathname]);

  useEffect(() => {
    if (!isDocumentReadingPage) {
      setIsHidden(false);
      return;
    }

    function handleScroll() {
      const panelToggleSlot = document.getElementById("reader-panel-toggle-slot");
      const panelOpen = panelToggleSlot?.getAttribute("data-panel-open") === "true";
      const currentScrollY = window.scrollY;
      const delta = currentScrollY - previousScrollYRef.current;
      previousScrollYRef.current = currentScrollY;

      if (panelOpen) {
        accumulatedDownRef.current = 0;
        setIsHidden(false);
        return;
      }

      if (delta > SCROLL_JITTER_THRESHOLD) {
        accumulatedDownRef.current += delta;
        if (accumulatedDownRef.current > SCROLL_HIDE_THRESHOLD) {
          setIsHidden(true);
        }
        return;
      }

      if (delta < 0) {
        accumulatedDownRef.current = 0;
        setIsHidden(false);
      }
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [isDocumentReadingPage]);

  return (
    <header
      className={cx(
        "sticky top-0 z-30 border-b border-[color:var(--border-subtle)] bg-[color:var(--bg-header)] backdrop-blur-xl transition-transform duration-300 ease-in-out",
        isDocumentReadingPage && isHidden ? "-translate-y-full" : "translate-y-0",
      )}
    >
      {children}
    </header>
  );
}
