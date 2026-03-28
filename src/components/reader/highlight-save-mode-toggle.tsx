"use client";

import type { HighlightSaveMode } from "@/lib/highlights/preferences";
import { cx } from "@/utils/cx";

type HighlightSaveModeToggleProps = {
  onChange: (value: HighlightSaveMode) => void;
  value: HighlightSaveMode;
};

const highlightSaveModeOptions: Array<{ description: string; label: string; value: HighlightSaveMode }> = [
  {
    description: "桌面端右键选择高亮或写批注。",
    label: "手动",
    value: "manual",
  },
  {
    description: "选中文字后松手即保存。",
    label: "自动",
    value: "auto",
  },
];

export function HighlightSaveModeToggle({ onChange, value }: HighlightSaveModeToggleProps) {
  const activeOption = highlightSaveModeOptions.find((option) => option.value === value) ?? highlightSaveModeOptions[0];

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[color:var(--text-tertiary)]">高亮保存</p>
        <p className="text-sm leading-6 text-[color:var(--text-secondary)]">{activeOption.description}</p>
      </div>
      <div className="inline-flex items-center rounded-full border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface-soft)] p-1">
        {highlightSaveModeOptions.map((option) => (
          <button
            aria-pressed={value === option.value}
            className={cx(
              "min-h-8 rounded-full px-3 text-xs font-semibold transition",
              value === option.value
                ? "bg-[color:var(--bg-surface-strong)] text-[color:var(--text-primary)] shadow-[var(--shadow-surface-muted)]"
                : "text-[color:var(--text-secondary)] hover:bg-[color:var(--button-quiet-hover-bg)] hover:text-[color:var(--text-primary)]",
            )}
            key={option.value}
            onClick={() => onChange(option.value)}
            type="button"
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
