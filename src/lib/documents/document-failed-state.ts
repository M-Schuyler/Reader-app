import type { CaptureIngestionError } from "@/server/modules/documents/document.types";

export type DocumentFailedState = {
  title: string;
  description: string;
  nextStep: string;
};

export function resolveDocumentFailedState(error: CaptureIngestionError | null | undefined): DocumentFailedState {
  if (!error) {
    return {
      title: "链接已保存，但正文暂不可读",
      description: "这篇内容还保留在你的阅读流里，只是当前没有拿到稳定、适合阅读的正文。",
      nextStep: "你可以先打开原文继续阅读，之后再回来重试导入。",
    };
  }

  switch (error.code) {
    case "VIDEO_SUBTITLE_UNAVAILABLE":
      return {
        title: "这条视频当前没有可用字幕",
        description: "Reader 依赖字幕来生成可阅读正文；这次没有拿到可用字幕轨道，所以暂时无法导入为视频阅读内容。",
        nextStep: "你可以先打开原视频确认是否提供字幕，或换一条有字幕的视频链接再导入。",
      };
    case "VIDEO_METADATA_FETCH_FAILED":
      return {
        title: "视频信息暂时获取失败",
        description: "Reader 这次没有拿到稳定的视频元数据或字幕列表，暂时无法完成导入。",
        nextStep: "稍后重试一次；如果持续失败，可先在浏览器确认该视频是否能正常播放。",
      };
    case "VIDEO_FETCH_FAILED":
      return {
        title: "视频页面暂时访问失败",
        description: "Reader 访问视频页面时遇到临时异常，没法完成后续字幕与正文处理。",
        nextStep: "稍后重试，或切换网络后再导入。",
      };
    case "VIDEO_URL_UNSUPPORTED":
      return {
        title: "这个视频链接格式暂不支持",
        description: "当前导入器只支持可稳定解析的 YouTube / B 站单视频链接，这个链接格式还无法处理。",
        nextStep: "请改用标准视频页链接后再导入。",
      };
    case "SOURCE_VERIFICATION_REQUIRED":
      return {
        title: "这篇文章需要先过来源验证",
        description: "Reader 已经帮你保存了链接，但当前访问环境下，来源站点没有把正文稳定地返回给我们。",
        nextStep: "你可以先打开原文确认内容仍然可访问，换个时间再重新导入。",
      };
    case "EXTRACTION_EMPTY":
      return {
        title: "正文没有成功提取出来",
        description: "页面已经打开了，但这次拿到的内容里没有稳定的正文文本，暂时还不适合在 Reader 里阅读。",
        nextStep: "先打开原文确认正文是否完整，之后再回来重试导入。",
      };
    case "EXTRACTION_UNREADABLE":
      if (isMigrationNotice(error.message)) {
        return {
          title: "这次保存到的是迁移说明，不是正文",
          description: "Reader 拿到的是公众号迁移或跳转说明页，不是你原本想保存的文章正文。",
          nextStep: "先打开原文找到新的正文链接，再重新导入那篇文章。",
        };
      }

      if (isWeChatShellPage(error.message)) {
        return {
          title: "这次保存到的是分享外壳，不是正文",
          description: "Reader 拿到的是微信分享页外壳，不是可以稳定抽取的正文内容。",
          nextStep: "先打开原文确认能直接看到正文，再回来重新导入。",
        };
      }

      return {
        title: "这篇文章当前不是可读正文",
        description: "Reader 这次拿到的页面不是稳定可读的正文内容，所以暂时没法把它整理进阅读视图。",
        nextStep: "你可以先打开原文确认页面内容，之后再回来重试导入。",
      };
    default:
      return {
        title: "链接已保存，但正文暂不可读",
        description: "这篇内容还保留在你的阅读流里，只是当前没有拿到稳定、适合阅读的正文。",
        nextStep: "你可以先打开原文继续阅读，之后再回来重试导入。",
      };
  }
}

function isMigrationNotice(message: string) {
  return /迁移|跳转说明/.test(message);
}

function isWeChatShellPage(message: string) {
  return /分享壳页面|壳页面|异常或壳页面/.test(message);
}
