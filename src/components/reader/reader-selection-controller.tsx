"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import type { CapturedSelection, SelectionAnchor } from "@/lib/highlights/selection";
import type { useDocumentHighlights } from "@/components/reader/reader-highlights";
import { useReaderPreferences } from "@/lib/highlights/preferences.store";

export type SelectionTrigger = "contextmenu" | "keyboard" | "mouse" | "touch";

export type ReaderSelectionState = CapturedSelection & {
  trigger: SelectionTrigger;
};

export type AutoHighlightFeedback = {
  anchor: SelectionAnchor;
  highlightId: string;
};

type UseReaderSelectionProps = {
  canHighlight: boolean;
  documentHighlights: ReturnType<typeof useDocumentHighlights>;
  onFloatingPanelOpen: () => void;
};

export function useReaderSelection({ canHighlight, documentHighlights, onFloatingPanelOpen }: UseReaderSelectionProps) {
  const highlightSaveMode = useReaderPreferences((state) => state.highlightSaveMode);
  const [selectionState, setSelectionState] = useState<ReaderSelectionState | null>(null);
  const [autoHighlightFeedback, setAutoHighlightFeedback] = useState<AutoHighlightFeedback | null>(null);

  const selectionActionsRef = useRef<HTMLDivElement>(null);
  const suppressNativeContextMenuRef = useRef(false);

  useEffect(() => {
    if (!canHighlight) {
      setAutoHighlightFeedback(null);
      setSelectionState(null);
    }
  }, [canHighlight]);

  useEffect(() => {
    if (!selectionState || selectionState.trigger === "contextmenu") {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;

      if (target instanceof Node && selectionActionsRef.current?.contains(target)) {
        return;
      }

      setSelectionState(null);
    }

    function handleViewportChange() {
      setSelectionState(null);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [selectionState]);

  useEffect(() => {
    if (!autoHighlightFeedback) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setAutoHighlightFeedback(null);
    }, 2600);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [autoHighlightFeedback]);

  function readSelectionState(trigger: SelectionTrigger, point?: { x: number; y: number }): ReaderSelectionState | null {
    const nextSelection = documentHighlights.readSelection(point ? { point } : undefined);

    if (!nextSelection) {
      return null;
    }

    return {
      ...nextSelection,
      trigger,
    };
  }

  function handleSelectionCapture(trigger: Exclude<SelectionTrigger, "contextmenu">) {
    if (!canHighlight) {
      return;
    }

    const nextSelection = readSelectionState(trigger);

    if (!nextSelection) {
      setSelectionState(null);
      return;
    }

    setAutoHighlightFeedback(null);

    if (highlightSaveMode === "auto" && trigger !== "keyboard") {
      setSelectionState(null);
      void handleAutoHighlight(nextSelection);
      return;
    }

    if (trigger === "mouse") {
      setSelectionState(null);
      return;
    }

    setSelectionState(nextSelection);
  }

  function handleSelectionMouseDown(event: MouseEvent<HTMLDivElement>) {
    if (event.button !== 2 || !canHighlight || highlightSaveMode === "auto") {
      return;
    }

    const nextSelection = readSelectionState("contextmenu", {
      x: event.clientX,
      y: event.clientY,
    });

    if (!nextSelection) {
      suppressNativeContextMenuRef.current = false;
      return;
    }

    event.preventDefault();
    suppressNativeContextMenuRef.current = true;
    setAutoHighlightFeedback(null);
    setSelectionState(nextSelection);
  }

  function handleSelectionContextMenu(event: MouseEvent<HTMLDivElement>) {
    if (suppressNativeContextMenuRef.current) {
      event.preventDefault();
      suppressNativeContextMenuRef.current = false;
      return;
    }

    if (!canHighlight || highlightSaveMode === "auto") {
      return;
    }

    const nextSelection = readSelectionState("contextmenu", {
      x: event.clientX,
      y: event.clientY,
    });

    if (!nextSelection) {
      return;
    }

    event.preventDefault();
    setAutoHighlightFeedback(null);
    setSelectionState(nextSelection);
  }

  function handleSelectionMouseUp(event: MouseEvent<HTMLDivElement>) {
    if (event.button !== 0 || suppressNativeContextMenuRef.current) {
      return;
    }

    handleSelectionCapture("mouse");
  }

  async function handleAutoHighlight(nextSelection: ReaderSelectionState) {
    const createdHighlight = await documentHighlights.createHighlightFromSelection(nextSelection.draft);

    if (!createdHighlight) {
      return;
    }

    setAutoHighlightFeedback({
      anchor: nextSelection.anchor,
      highlightId: createdHighlight.id,
    });
  }

  async function handleCreateHighlight() {
    if (!selectionState) {
      return;
    }

    const createdHighlight = await documentHighlights.createHighlightFromSelection(selectionState.draft);

    if (!createdHighlight) {
      return;
    }

    setSelectionState(null);
  }

  async function handleCreateHighlightNote() {
    if (!selectionState) {
      return;
    }

    const createdHighlight = await documentHighlights.createHighlightFromSelection(selectionState.draft);

    if (!createdHighlight) {
      return;
    }

    setSelectionState(null);
    documentHighlights.requestHighlightNoteFocus(createdHighlight.id);
  }

  function handleAutoHighlightNote() {
    if (!autoHighlightFeedback) {
      return;
    }

    onFloatingPanelOpen();
    documentHighlights.requestHighlightNoteFocus(autoHighlightFeedback.highlightId);
    setAutoHighlightFeedback(null);
  }

  return {
    selectionState,
    autoHighlightFeedback,
    selectionActionsRef,
    clearSelection: () => setSelectionState(null),
    clearAutoHighlightFeedback: () => setAutoHighlightFeedback(null),
    handleSelectionCapture,
    handleSelectionMouseDown,
    handleSelectionContextMenu,
    handleSelectionMouseUp,
    handleCreateHighlight,
    handleCreateHighlightNote,
    handleAutoHighlightNote,
  };
}
