export type VideoProvider = "youtube" | "bilibili";

export type VideoSyncMode = "full" | "manual" | "seek";

export type TranscriptSource = "NATIVE" | "GEMINI" | "NONE";

export type TranscriptStatus = "PENDING" | "READY" | "FAILED";

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
  transcriptSource: TranscriptSource;
  transcriptStatus: TranscriptStatus;
};
