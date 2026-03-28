"use client";

import { buildTextAnchor } from "./anchor";

export type SelectionDraft = {
  quoteText: string;
  startOffset: number;
  endOffset: number;
  selectorJson: null;
};

export type SelectionAnchor = {
  left: number;
  top: number;
};

export type CapturedSelection = {
  anchor: SelectionAnchor;
  draft: SelectionDraft;
};

type CaptureSelectionOptions = {
  point?: {
    x: number;
    y: number;
  };
};

export function captureSelectionDraft(root: HTMLElement): SelectionDraft | null {
  return captureSelection(root)?.draft ?? null;
}

export function captureSelection(root: HTMLElement, options?: CaptureSelectionOptions): CapturedSelection | null {
  if (typeof window === "undefined") {
    return null;
  }

  const selection = window.getSelection();

  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return null;
  }

  const range = selection.getRangeAt(0);

  if (!root.contains(range.commonAncestorContainer)) {
    return null;
  }

  const startOffset = toRangeOffset(root, range.startContainer, range.startOffset);
  const endOffset = toRangeOffset(root, range.endContainer, range.endOffset);

  if (startOffset >= endOffset) {
    return null;
  }

  const sourceText = root.textContent ?? "";
  const draft = buildTextAnchor(sourceText, startOffset, endOffset);

  if (!draft.quoteText.trim()) {
    return null;
  }

  return {
    anchor: resolveSelectionAnchor(range, options?.point),
    draft,
  };
}

function toRangeOffset(root: HTMLElement, container: Node, offset: number) {
  const range = document.createRange();
  range.selectNodeContents(root);
  range.setEnd(container, offset);
  return range.toString().length;
}

function resolveSelectionAnchor(range: Range, point?: { x: number; y: number }): SelectionAnchor {
  if (typeof window === "undefined") {
    return { left: 0, top: 0 };
  }

  const rect = range.getBoundingClientRect();
  const rawLeft = point?.x ?? rect.left + rect.width / 2;
  const rawTop = point?.y ?? rect.top;

  return {
    left: clamp(rawLeft, 20, window.innerWidth - 20),
    top: clamp(rawTop, 20, window.innerHeight - 20),
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
