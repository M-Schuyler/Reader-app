export type TextNeighborKind = "none" | "text" | "inline" | "block";

type WhitespaceContext = {
  previous: TextNeighborKind;
  next: TextNeighborKind;
};

export function shouldRenderTextNode(textContent: string, context: WhitespaceContext) {
  if (textContent.length === 0) {
    return false;
  }

  if (textContent.trim().length > 0) {
    return true;
  }

  return isInlineFlowContext(context.previous) && isInlineFlowContext(context.next);
}

function isInlineFlowContext(kind: TextNeighborKind) {
  return kind === "text" || kind === "inline";
}
