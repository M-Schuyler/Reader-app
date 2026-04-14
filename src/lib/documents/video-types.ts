export type VideoProvider = "youtube" | "bilibili";

export type VideoSyncMode = "full" | "manual";

export type TranscriptSegment = {
  start: number;
  end: number;
  text: string;
};

export type DocumentVideoEmbed = {
  provider: VideoProvider;
  embedUrl: string;
  segments: TranscriptSegment[];
  syncMode: VideoSyncMode;
};
