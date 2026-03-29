export type CaptureUrlSubmitPayload = {
  deduped: boolean;
  document: {
    id: string;
  };
};

export type CaptureUrlSubmitSuccess =
  | {
      kind: "redirect";
      href: "/sources";
    }
  | {
      kind: "deduped";
      message: "这篇文章已收藏，不再重复导入。";
      actionLabel: "前往已有文章";
      actionHref: string;
    };

export function resolveCaptureUrlSubmitSuccess(data: CaptureUrlSubmitPayload): CaptureUrlSubmitSuccess {
  if (data.deduped) {
    return {
      kind: "deduped",
      message: "这篇文章已收藏，不再重复导入。",
      actionLabel: "前往已有文章",
      actionHref: `/documents/${encodeURIComponent(data.document.id)}`,
    };
  }

  return {
    kind: "redirect",
    href: "/sources",
  };
}
