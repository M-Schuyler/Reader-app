"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { CaptureUrlForm } from "@/components/library/capture-url-form";
import { CreateSourceForm } from "@/components/library/create-source-form";
import { cx } from "@/utils/cx";

type SourceLibraryMoreMenuProps = {
  sweepHref?: string;
};

export function SourceLibraryMoreMenu({ sweepHref }: SourceLibraryMoreMenuProps) {
  void sweepHref;

  const [open, setOpen] = useState(false);
  const [expandedSection, setExpandedSection] = useState<"capture" | "source" | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  function closeMenu() {
    setOpen(false);
    setExpandedSection(null);
  }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        closeMenu();
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        className="inline-flex min-h-9 w-9 items-center justify-center rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface-soft)] text-sm text-[color:var(--text-secondary)] transition hover:border-[color:var(--border-strong)] hover:text-[color:var(--text-primary)]"
        onClick={() => {
          setOpen((value) => {
            const next = !value;
            if (!next) {
              setExpandedSection(null);
            }
            return next;
          });
        }}
      >
        ···
      </button>

      {open && (
        <>
          <button
            aria-label="关闭菜单"
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]"
            onClick={closeMenu}
            type="button"
          />
          <div className="absolute right-0 top-[calc(100%+6px)] z-50 min-w-[280px] w-[min(92vw,24rem)] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-[20px] border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] shadow-[var(--shadow-surface)]">
            <div className="p-1.5">
              <ExpandableMenuSection
                expanded={expandedSection === "capture"}
                label="保存网页链接"
                onToggle={() => setExpandedSection((current) => (current === "capture" ? null : "capture"))}
              >
                <CaptureUrlForm variant="menu" />
              </ExpandableMenuSection>
              <ExpandableMenuSection
                expanded={expandedSection === "source"}
                label="添加 RSS 来源"
                onToggle={() => setExpandedSection((current) => (current === "source" ? null : "source"))}
              >
                <CreateSourceForm variant="menu" />
              </ExpandableMenuSection>
              <SweepButton onDone={closeMenu} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ExpandableMenuSection(props: {
  expanded: boolean;
  label: string;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[14px]">
      <button
        aria-expanded={props.expanded}
        className={cx(
          "flex w-full items-center justify-between gap-3 rounded-[12px] px-3 py-2.5 text-left text-sm transition",
          props.expanded
            ? "bg-[color:var(--bg-surface-soft)] text-[color:var(--text-primary)]"
            : "text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-surface-soft)] hover:text-[color:var(--text-primary)]",
        )}
        onClick={props.onToggle}
        type="button"
      >
        <span>{props.label}</span>
        <span aria-hidden="true" className="text-base leading-none text-[color:var(--text-tertiary)]">
          {props.expanded ? "∨" : "›"}
        </span>
      </button>
      {props.expanded ? (
        <div className="mt-1 rounded-[16px] border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface-strong)] px-3 py-3">
          {props.children}
        </div>
      ) : null}
    </div>
  );
}

function SweepButton({ onDone }: { onDone: () => void }) {
  const [state, setState] = useState<"idle" | "running" | "done">("idle");

  async function handleSweep() {
    setState("running");
    try {
      await fetch("/api/summary-jobs/sweep", { method: "POST" });
    } finally {
      setState("done");
      setTimeout(() => {
        setState("idle");
        onDone();
      }, 1500);
    }
  }

  return (
    <button
      className="flex w-full items-center gap-2.5 rounded-[12px] px-3 py-2.5 text-sm text-[color:var(--text-secondary)] transition hover:bg-[color:var(--bg-surface-soft)] hover:text-[color:var(--text-primary)] disabled:opacity-50"
      disabled={state === "running"}
      onClick={handleSweep}
    >
      {state === "idle" && "补跑摘要"}
      {state === "running" && "运行中…"}
      {state === "done" && "完成"}
    </button>
  );
}
