"use client";

import type { RefObject } from "react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import type { SelectionAnchor } from "@/lib/highlights/selection";
import { cx } from "@/utils/cx";

type ReaderSelectionActionsProps = {
  actionsRef?: RefObject<HTMLDivElement | null>;
  anchor: SelectionAnchor;
  isSaving: boolean;
  onHighlight: () => void;
  onNote: () => void;
  variant: "contextmenu" | "floating";
};

type ReaderAutoHighlightFeedbackProps = {
  anchor: SelectionAnchor;
  onNote: () => void;
};

export function ReaderSelectionActions({
  actionsRef,
  anchor,
  isSaving,
  onHighlight,
  onNote,
  variant,
}: ReaderSelectionActionsProps) {
  return (
    <div
      className={cx(
        "fixed z-30",
        variant === "contextmenu" ? "translate-y-2" : "-translate-x-1/2 -translate-y-[calc(100%+14px)]",
      )}
      ref={actionsRef}
      style={{
        left: `${anchor.left}px`,
        top: `${anchor.top}px`,
      }}
    >
      <Panel className="flex items-center gap-2 rounded-[20px] border-[color:var(--border-strong)] bg-[color:var(--bg-surface-strong)] p-2 shadow-[var(--shadow-surface)]">
        <Button
          disabled={isSaving}
          onClick={onHighlight}
          size="sm"
          variant="secondary"
        >
          {isSaving ? "保存中…" : "高亮"}
        </Button>
        <Button
          disabled={isSaving}
          onClick={onNote}
          size="sm"
          variant="quiet"
        >
          写批注
        </Button>
      </Panel>
    </div>
  );
}

export function ReaderAutoHighlightFeedback({ anchor, onNote }: ReaderAutoHighlightFeedbackProps) {
  return (
    <div
      className="fixed z-20 -translate-x-1/2 -translate-y-[calc(100%+14px)]"
      style={{
        left: `${anchor.left}px`,
        top: `${anchor.top}px`,
      }}
    >
      <Panel className="flex items-center gap-3 rounded-[20px] border-[color:var(--border-strong)] bg-[color:var(--bg-surface-strong)] px-3 py-2 shadow-[var(--shadow-surface-muted)]">
        <p className="text-sm text-[color:var(--text-secondary)]">已自动高亮</p>
        <Button
          onClick={onNote}
          size="sm"
          variant="quiet"
        >
          写批注
        </Button>
      </Panel>
    </div>
  );
}
