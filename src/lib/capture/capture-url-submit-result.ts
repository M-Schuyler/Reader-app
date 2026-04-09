export type CaptureUrlSubmitPayload = {
  deduped: boolean;
  document: {
    id: string;
  };
  ingestion: {
    error: {
      code: string;
      message: string;
    } | null;
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
    }
  | {
      kind: "failed";
      message: string;
      actionLabel: "查看失败记录";
      actionHref: string;
    };

export function resolveCaptureUrlSubmitSuccess(data: CaptureUrlSubmitPayload): CaptureUrlSubmitSuccess {
  if (data.ingestion.error) {
    return {
      kind: "failed",
      message: localizeCaptureIngestionError(data.ingestion.error),
      actionLabel: "查看失败记录",
      actionHref: `/documents/${encodeURIComponent(data.document.id)}`,
    };
  }

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

function localizeCaptureIngestionError(error: { code: string; message: string }) {
  switch (error.code) {
    case "SOURCE_VERIFICATION_REQUIRED":
      return "这篇微信文章触发了来源验证，当前环境下还抓不到正文。";
    case "FETCH_FAILED":
      return "抓取原始链接失败，请稍后再试。";
    case "EXTRACTION_EMPTY":
      return "页面打开了，但没有提取到可阅读正文。";
    case "EXTRACTION_UNREADABLE":
      return error.message;
    default:
      return error.message || "保存链接失败，请稍后再试。";
  }
}
