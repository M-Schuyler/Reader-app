import type {
  DocumentVideoEmbed,
  TranscriptSegment,
  TranscriptSource,
  TranscriptStatus,
  VideoProvider,
  VideoSyncMode,
} from "./video-types";

const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com"]);
const BILIBILI_HOSTS = new Set(["www.bilibili.com", "m.bilibili.com", "bilibili.com", "player.bilibili.com"]);
const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const BILIBILI_BVID_PATTERN = /^BV[0-9A-Za-z]{10}$/;

export type ResolvedVideoIdentity = {
  provider: VideoProvider;
  id: string;
  startSeconds: number | null;
};

export function resolveDocumentVideoEmbed({
  videoProvider,
  videoUrl,
  canonicalUrl,
  sourceUrl,
  transcriptSegments,
  transcriptSource,
  transcriptStatus,
}: {
  videoProvider?: string | null;
  videoUrl?: string | null;
  canonicalUrl: string | null;
  sourceUrl: string | null;
  transcriptSegments?: unknown;
  transcriptSource?: string | null;
  transcriptStatus?: string | null;
}): DocumentVideoEmbed | null {
  const normalizedProvider = normalizeVideoProvider(videoProvider);
  const candidates = [videoUrl, canonicalUrl, sourceUrl].filter((value): value is string => Boolean(value?.trim()));

  let identity: ResolvedVideoIdentity | null = null;

  if (normalizedProvider) {
    for (const candidate of candidates) {
      identity = resolveVideoIdentityWithProvider(candidate, normalizedProvider);
      if (identity) {
        break;
      }
    }
  }

  if (!identity) {
    for (const candidate of candidates) {
      identity = resolveVideoIdentityFromUrl(candidate);
      if (identity) {
        break;
      }
    }
  }

  if (!identity) {
    return null;
  }

  return {
    provider: identity.provider,
    embedUrl: buildVideoEmbedUrl(identity),
    segments: normalizeTranscriptSegments(transcriptSegments),
    syncMode: resolveVideoSyncMode(identity.provider, transcriptSource),
    transcriptSource: normalizeTranscriptSource(transcriptSource),
    transcriptStatus: normalizeTranscriptStatus(transcriptStatus),
  };
}

export function normalizeVideoProvider(value: string | null | undefined): VideoProvider | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  switch (normalized) {
    case "youtube":
      return "youtube";
    case "bilibili":
      return "bilibili";
    default:
      return null;
  }
}

export function resolveVideoIdentityFromUrl(value: string): ResolvedVideoIdentity | null {
  const url = parseUrl(value);
  if (!url) {
    return null;
  }

  const youtubeId = parseYoutubeVideoId(url);
  if (youtubeId) {
    return {
      provider: "youtube",
      id: youtubeId,
      startSeconds: resolveStartSeconds(url),
    };
  }

  const bvid = parseBilibiliBvid(url);
  if (bvid) {
    return {
      provider: "bilibili",
      id: bvid,
      startSeconds: null,
    };
  }

  return null;
}

export function resolveVideoIdentityWithProvider(value: string, provider: VideoProvider): ResolvedVideoIdentity | null {
  const url = parseUrl(value);
  if (!url) {
    return null;
  }

  if (provider === "youtube") {
    const id = parseYoutubeVideoId(url);
    if (!id) {
      return null;
    }
    return {
      provider,
      id,
      startSeconds: resolveStartSeconds(url),
    };
  }

  const bvid = parseBilibiliBvid(url);
  if (!bvid) {
    return null;
  }

  return {
    provider,
    id: bvid,
    startSeconds: null,
  };
}

export function buildVideoExternalId(identity: Pick<ResolvedVideoIdentity, "provider" | "id">) {
  return `${identity.provider}:${identity.id}`;
}

export function resolveVideoSyncMode(provider: VideoProvider, transcriptSource?: string | null): VideoSyncMode {
  if (transcriptSource === "GEMINI") {
    return "seek";
  }

  return provider === "youtube" ? "full" : "manual";
}

export function normalizeTranscriptSource(value: string | null | undefined): TranscriptSource {
  if (value === "GEMINI") {
    return "GEMINI";
  }

  if (value === "NATIVE") {
    return "NATIVE";
  }

  return "NONE";
}

export function normalizeTranscriptStatus(value: string | null | undefined): TranscriptStatus {
  if (value === "PENDING") {
    return "PENDING";
  }

  if (value === "FAILED") {
    return "FAILED";
  }

  return "READY";
}

export function normalizeTranscriptSegments(value: unknown): TranscriptSegment[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const normalizedSegments: TranscriptSegment[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }

    const record = item as { start?: unknown; end?: unknown; text?: unknown };
    const start = typeof record.start === "number" ? record.start : Number.NaN;
    const end = typeof record.end === "number" ? record.end : Number.NaN;
    const text = typeof record.text === "string" ? record.text.trim() : "";

    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || !text) {
      continue;
    }

    normalizedSegments.push({
      start,
      end,
      text,
    });
  }

  return normalizedSegments.sort((left, right) => left.start - right.start);
}

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function parseYoutubeVideoId(url: URL): string | null {
  const hostname = url.hostname.toLowerCase();
  let videoId: string | null = null;

  if (hostname === "youtu.be") {
    videoId = url.pathname.split("/").filter(Boolean)[0] ?? null;
  } else if (YOUTUBE_HOSTS.has(hostname)) {
    if (url.pathname === "/watch") {
      videoId = url.searchParams.get("v");
    } else if (url.pathname.startsWith("/shorts/") || url.pathname.startsWith("/embed/")) {
      videoId = url.pathname.split("/").filter(Boolean)[1] ?? null;
    }
  }

  return normalizeYoutubeVideoId(videoId);
}

function parseBilibiliBvid(url: URL): string | null {
  const hostname = url.hostname.toLowerCase();
  if (!BILIBILI_HOSTS.has(hostname)) {
    return null;
  }

  const queryBvid = normalizeBilibiliBvid(url.searchParams.get("bvid"));
  if (queryBvid) {
    return queryBvid;
  }

  const match = url.pathname.match(/\/video\/(BV[0-9A-Za-z]{10})/i);
  if (match?.[1]) {
    return normalizeBilibiliBvid(match[1]);
  }

  return null;
}

function normalizeYoutubeVideoId(videoId: string | null): string | null {
  if (!videoId) {
    return null;
  }
  const normalized = videoId.trim();
  if (!YOUTUBE_VIDEO_ID_PATTERN.test(normalized)) {
    return null;
  }
  return normalized;
}

function normalizeBilibiliBvid(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  if (!BILIBILI_BVID_PATTERN.test(normalized)) {
    return null;
  }

  return `BV${normalized.slice(2)}`;
}

function buildVideoEmbedUrl(identity: ResolvedVideoIdentity) {
  if (identity.provider === "youtube") {
    const embedUrl = new URL(`https://www.youtube.com/embed/${identity.id}`);
    embedUrl.searchParams.set("enablejsapi", "1");
    embedUrl.searchParams.set("playsinline", "1");
    embedUrl.searchParams.set("rel", "0");
    if (identity.startSeconds !== null) {
      embedUrl.searchParams.set("start", String(identity.startSeconds));
    }

    return embedUrl.toString();
  }

  const embedUrl = new URL("https://player.bilibili.com/player.html");
  embedUrl.searchParams.set("bvid", identity.id);
  embedUrl.searchParams.set("page", "1");
  embedUrl.searchParams.set("high_quality", "1");
  return embedUrl.toString();
}

function resolveStartSeconds(url: URL): number | null {
  const queryStart = parseDurationSeconds(url.searchParams.get("start"));
  if (queryStart !== null) {
    return queryStart;
  }

  const queryTime = parseDurationSeconds(url.searchParams.get("t"));
  if (queryTime !== null) {
    return queryTime;
  }

  if (url.hash.startsWith("#t=")) {
    return parseDurationSeconds(url.hash.slice(3));
  }
  return null;
}

function parseDurationSeconds(value: string | null): number | null {
  if (!value) {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (/^\d+$/.test(normalized)) {
    const seconds = Number(normalized);
    return Number.isSafeInteger(seconds) && seconds > 0 ? seconds : null;
  }

  const match = normalized.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (!match) {
    return null;
  }

  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  const totalSeconds = hours * 3600 + minutes * 60 + seconds;
  return totalSeconds > 0 ? totalSeconds : null;
}
