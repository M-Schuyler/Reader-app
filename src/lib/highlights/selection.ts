"use client";

import { buildTextAnchor } from "./anchor";

export type SelectionDraft = {
  quoteText: string;
  startOffset: number;
  endOffset: number;
  selectorJson: null;
};

export function captureSelectionDraft(root: HTMLElement): SelectionDraft | null {
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

  return draft;
}

function toRangeOffset(root: HTMLElement, container: Node, offset: number) {
  const range = document.createRange();
  range.selectNodeContents(root);
  range.setEnd(container, offset);
  return range.toString().length;
}
