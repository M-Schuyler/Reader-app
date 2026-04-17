"use client";

import { ReadState } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Panel } from "@/components/ui/panel";
import type { DocumentVideoEmbed } from "@/lib/documents/video-types";

const YOUTUBE_POLL_INTERVAL_MS = 600;
const TRANSCRIPT_PENDING_POLL_INTERVAL_MS = 10_000;
const VIDEO_READ_THRESHOLD = 0.88;

type VideoReaderProps = {
  documentId: string;
  readState: ReadState;
  sourceUrl: string | null;
  title: string;
  videoDurationSeconds: number | null;
  videoEmbed: DocumentVideoEmbed;
};

type YouTubePlayerInstance = {
  destroy: () => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
};

type YouTubeApi = {
  Player: new (
    target: HTMLIFrameElement,
    options: {
      events?: {
        onReady?: () => void;
      };
    },
  ) => YouTubePlayerInstance;
};

declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let youtubeIframeApiPromise: Promise<YouTubeApi> | null = null;

export function VideoReader({
  documentId,
  readState,
  sourceUrl,
  title,
  videoDurationSeconds,
  videoEmbed,
}: VideoReaderProps) {
  const router = useRouter();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const segmentRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const markedReadRef = useRef(false);
  const transcriptSweepRequestedRef = useRef(false);
  const [currentTimeSeconds, setCurrentTimeSeconds] = useState<number | null>(null);
  const [playerDurationSeconds, setPlayerDurationSeconds] = useState<number | null>(null);
  const [manualFocusedSegmentIndex, setManualFocusedSegmentIndex] = useState<number | null>(null);
  const [seekTo, setSeekTo] = useState<(seconds: number) => void>(() => () => undefined);

  const isYouTubeFullSync = videoEmbed.provider === "youtube" && videoEmbed.syncMode === "full";
  const isSeekMode = videoEmbed.syncMode === "seek";
  const canSeek = isYouTubeFullSync || isSeekMode;
  const effectiveDurationSeconds = playerDurationSeconds ?? videoDurationSeconds;
  const isPendingGeminiTranscript =
    videoEmbed.transcriptStatus === "PENDING" && videoEmbed.transcriptSource === "GEMINI";

  useEffect(() => {
    if (!canSeek || !iframeRef.current) {
      setSeekTo(() => () => undefined);
      setCurrentTimeSeconds(null);
      setPlayerDurationSeconds(null);
      return;
    }

    let intervalId: number | null = null;
    let canceled = false;
    let player: YouTubePlayerInstance | null = null;

    void loadYouTubeIframeApi()
      .then((api) => {
        if (canceled || !iframeRef.current) {
          return;
        }

        const nextPlayer = new api.Player(iframeRef.current, {
          events: {
            onReady: () => {
              setSeekTo(() => (seconds: number) => {
                if (!nextPlayer) {
                  return;
                }

                try {
                  nextPlayer.seekTo(seconds, true);
                } catch {
                  return;
                }
              });

              try {
                const duration = nextPlayer.getDuration();
                if (Number.isFinite(duration) && duration > 0) {
                  setPlayerDurationSeconds(duration);
                }
              } catch {
                return;
              }
            },
          },
        });
        player = nextPlayer;

        intervalId = window.setInterval(() => {
          if (!player) {
            return;
          }

          try {
            const nextCurrentTime = player.getCurrentTime();
            if (Number.isFinite(nextCurrentTime) && nextCurrentTime >= 0) {
              setCurrentTimeSeconds(nextCurrentTime);
            }

            const nextDuration = player.getDuration();
            if (Number.isFinite(nextDuration) && nextDuration > 0) {
              setPlayerDurationSeconds(nextDuration);
            }
          } catch {
            return;
          }
        }, YOUTUBE_POLL_INTERVAL_MS);
      })
      .catch(() => undefined);

    return () => {
      canceled = true;
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
      setSeekTo(() => () => undefined);
      setCurrentTimeSeconds(null);
      setPlayerDurationSeconds(null);
      player?.destroy();
    };
  }, [canSeek, videoEmbed.embedUrl]);

  const syncedActiveSegmentIndex = useMemo(
    () => resolveActiveTranscriptSegment(videoEmbed.segments, currentTimeSeconds),
    [videoEmbed.segments, currentTimeSeconds],
  );
  const activeSegmentIndex = canSeek ? syncedActiveSegmentIndex : manualFocusedSegmentIndex;

  useEffect(() => {
    if (activeSegmentIndex === null) {
      return;
    }

    const activeSegmentElement = segmentRefs.current[activeSegmentIndex];
    activeSegmentElement?.scrollIntoView({
      block: "nearest",
      behavior: "smooth",
    });
  }, [activeSegmentIndex]);

  useEffect(() => {
    if (!isPendingGeminiTranscript) {
      transcriptSweepRequestedRef.current = false;
      return;
    }

    if (transcriptSweepRequestedRef.current) {
      return;
    }

    transcriptSweepRequestedRef.current = true;
    void fetch("/api/transcript-jobs/sweep", { method: "POST" })
      .then(() => {
        router.refresh();
      })
      .catch(() => undefined);
  }, [isPendingGeminiTranscript, router]);

  useEffect(() => {
    if (!isPendingGeminiTranscript) {
      return;
    }

    const intervalId = window.setInterval(() => {
      router.refresh();
    }, TRANSCRIPT_PENDING_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isPendingGeminiTranscript, router]);

  useEffect(() => {
    if (!canSeek || readState === ReadState.READ) {
      return;
    }

    if (markedReadRef.current) {
      return;
    }

    if (!effectiveDurationSeconds || !currentTimeSeconds) {
      return;
    }

    if (currentTimeSeconds / effectiveDurationSeconds < VIDEO_READ_THRESHOLD) {
      return;
    }

    markedReadRef.current = true;
    void markDocumentAsRead(documentId)
      .then(() => {
        router.refresh();
      })
      .catch(() => undefined);
  }, [currentTimeSeconds, documentId, effectiveDurationSeconds, canSeek, readState, router]);

  return (
    <div className="space-y-6">
      <div className="sticky top-[78px] z-20 space-y-2 bg-[color:var(--bg-surface-strong)] pb-2">
        <div className="relative overflow-hidden rounded-[22px] border border-[color:var(--border-subtle)] bg-black pt-[56.25%]">
          <iframe
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
            loading="lazy"
            ref={iframeRef}
            referrerPolicy="strict-origin-when-cross-origin"
            src={videoEmbed.embedUrl}
            title={title}
          />
        </div>
        <p className="text-xs leading-6 text-[color:var(--text-tertiary)]">
          {isYouTubeFullSync
            ? "YouTube 同步模式：点击字幕可跳转到对应时间点，并随播放进度自动高亮。"
            : isSeekMode 
            ? "Gemini 生成字幕：点击可跳转播放，由于非原生字幕，同步可能存在微小偏差。"
            : "B 站手动模式：当前仅提供播放器与字幕阅读，不承诺自动时间同步。"}
        </p>
      </div>

      <Panel className="border-[color:var(--border-subtle)] bg-[color:var(--bg-surface-soft)] shadow-none">
        <div className="space-y-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-[color:var(--text-tertiary)]">字幕</p>
          {videoEmbed.segments.length > 0 ? (
            <div className="max-h-[380px] overflow-y-auto rounded-[16px] border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface)] px-4 py-3">
              <div className="text-[15px] leading-8 text-[color:var(--text-secondary)]">
                {videoEmbed.segments.map((segment, index) => {
                  const isActive = activeSegmentIndex === index;
                  return (
                    <button
                      className={`mb-1 mr-1 inline-block rounded-[10px] px-1.5 py-0.5 text-left align-baseline text-[15px] leading-8 transition ${
                        isActive
                          ? "bg-[color:var(--bg-surface-strong)] text-[color:var(--text-primary)]"
                          : "text-[color:var(--text-secondary)] hover:bg-[color:var(--bg-surface-strong)]"
                      }`}
                      key={`${segment.start}-${segment.end}-${index}`}
                      onClick={() => {
                        if (canSeek) {
                          seekTo(segment.start);
                        } else {
                          setManualFocusedSegmentIndex(index);
                        }
                      }}
                      ref={(element) => {
                        segmentRefs.current[index] = element;
                      }}
                      title={`跳转到 ${formatVideoTime(segment.start)}`}
                      type="button"
                    >
                      <span
                        className={`mr-1 align-middle text-[10px] ${
                          isActive ? "text-[color:var(--text-secondary)]" : "text-[color:var(--text-tertiary)]"
                        }`}
                      >
                        {formatVideoTime(segment.start)}
                      </span>
                      {segment.text}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-sm leading-7 text-[color:var(--text-secondary)]">
              {videoEmbed.transcriptStatus === "PENDING"
                ? "字幕生成中..."
                : videoEmbed.provider === "youtube"
                ? "当前还没拿到可用字幕。常见原因是视频本身没开放字幕，或者 YouTube 暂时拦截了字幕抓取；之后重新导入时，Reader 会继续重试。"
                : "当前视频暂无可用字幕。"}
            </p>
          )}

          {sourceUrl ? (
            <a
              className="inline-flex min-h-10 items-center rounded-[18px] border border-[color:var(--border-subtle)] bg-[color:var(--bg-surface-strong)] px-4 text-sm font-medium text-[color:var(--text-primary)] transition hover:border-[color:var(--border-strong)] hover:bg-[color:var(--button-secondary-hover-bg)]"
              href={sourceUrl}
              rel="noreferrer"
              target="_blank"
            >
              打开原始链接
            </a>
          ) : null}
        </div>
      </Panel>
    </div>
  );
}

function resolveActiveTranscriptSegment(segments: DocumentVideoEmbed["segments"], currentTimeSeconds: number | null) {
  if (currentTimeSeconds === null || segments.length === 0) {
    return null;
  }

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    if (currentTimeSeconds >= segment.start && currentTimeSeconds < segment.end) {
      return index;
    }
  }

  if (currentTimeSeconds >= segments[segments.length - 1]!.end) {
    return segments.length - 1;
  }

  return null;
}

function formatVideoTime(value: number) {
  const safeSeconds = Math.max(0, Math.floor(value));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

async function markDocumentAsRead(documentId: string) {
  const response = await fetch(`/api/documents/${documentId}/read-state`, {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      readState: ReadState.READ,
    }),
  });

  if (!response.ok) {
    throw new Error("Failed to mark video document as read.");
  }
}

function loadYouTubeIframeApi(): Promise<YouTubeApi> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("YouTube API is unavailable on the server."));
  }

  if (window.YT?.Player) {
    return Promise.resolve(window.YT);
  }

  if (youtubeIframeApiPromise) {
    return youtubeIframeApiPromise;
  }

  youtubeIframeApiPromise = new Promise<YouTubeApi>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>("script[data-reader-youtube-api='true']");
    const script = existingScript ?? document.createElement("script");

    const resolveApi = () => {
      if (window.YT?.Player) {
        resolve(window.YT);
      } else {
        reject(new Error("YouTube API loaded without Player API."));
      }
    };

    window.onYouTubeIframeAPIReady = resolveApi;

    if (!existingScript) {
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.defer = true;
      script.setAttribute("data-reader-youtube-api", "true");
      script.onerror = () => {
        reject(new Error("Failed to load YouTube iframe API."));
      };
      document.head.appendChild(script);
    }

    window.setTimeout(() => {
      if (window.YT?.Player) {
        resolveApi();
      }
    }, 2_500);
  });

  return youtubeIframeApiPromise;
}
