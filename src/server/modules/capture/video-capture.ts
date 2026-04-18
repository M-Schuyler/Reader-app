import { createHash } from "node:crypto";
import { load } from "cheerio";
import { TranscriptSource, TranscriptStatus } from "@prisma/client";
import { RouteError } from "@/server/api/response";
import {
  buildVideoExternalId,
  resolveVideoIdentityFromUrl,
  type ResolvedVideoIdentity,
} from "@/lib/documents/video-embed";
import type { TranscriptSegment, VideoProvider } from "@/lib/documents/video-types";

const VIDEO_FETCH_TIMEOUT_MS = 15_000;
const VIDEO_CAPTURE_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36";
const BILIBILI_SHORT_HOSTS = new Set(["b23.tv", "www.b23.tv", "bili2233.cn", "www.bili2233.cn"]);
const YOUTUBE_IOS_CLIENT_VERSION = "20.11.6";
const YOUTUBE_IOS_CLIENT_NAME_PROTO = "5";
const YOUTUBE_IOS_USER_AGENT = "com.google.ios.youtube/20.11.6 (iPhone14,5; U; CPU iOS 18_5 like Mac OS X;)";
const YOUTUBE_INNERTUBE_API_KEY_PATTERNS = [/"INNERTUBE_API_KEY":"([^"]+)"/, /"innertubeApiKey":"([^"]+)"/];

type YoutubeCaptionTrack = {
  baseUrl?: string;
  languageCode?: string;
  kind?: string;
};

type YoutubeCaptureMetadata = {
  title: string | null;
  author: string | null;
  publishedAt: Date | null;
  videoThumbnailUrl: string | null;
  videoDurationSeconds: number | null;
};

export type CapturedVideoDocument = {
  provider: VideoProvider;
  externalId: string;
  canonicalUrl: string;
  videoUrl: string;
  title: string;
  author: string | null;
  lang: string | null;
  excerpt: string;
  plainText: string;
  textHash: string;
  wordCount: number;
  publishedAt: Date | null;
  videoThumbnailUrl: string | null;
  videoDurationSeconds: number | null;
  transcriptSegments: TranscriptSegment[];
  transcriptSource: TranscriptSource;
  transcriptStatus: TranscriptStatus;
};

export function resolveVideoExternalIdHint(inputUrl: string) {
  const identity = resolveVideoIdentityFromUrl(inputUrl);
  if (!identity) {
    return null;
  }

  return buildVideoExternalId(identity);
}

export function isVideoCaptureCandidate(inputUrl: string) {
  const parsed = safeParseUrl(inputUrl);
  if (!parsed) {
    return false;
  }

  const hostname = parsed.hostname.toLowerCase();
  if (hostname === "youtu.be" || hostname === "youtube.com" || hostname === "www.youtube.com" || hostname === "m.youtube.com") {
    return true;
  }

  if (hostname === "www.bilibili.com" || hostname === "m.bilibili.com" || hostname === "bilibili.com") {
    return true;
  }

  return BILIBILI_SHORT_HOSTS.has(hostname);
}

export async function captureVideoDocument(inputUrl: string): Promise<CapturedVideoDocument | null> {
  const directIdentity = resolveVideoIdentityFromUrl(inputUrl);
  if (directIdentity?.provider === "youtube") {
    return captureYoutubeVideoDocument(directIdentity);
  }

  if (directIdentity?.provider === "bilibili") {
    return captureBilibiliVideoDocument(inputUrl, directIdentity.id);
  }

  const parsedUrl = safeParseUrl(inputUrl);
  if (!parsedUrl) {
    return null;
  }

  if (BILIBILI_SHORT_HOSTS.has(parsedUrl.hostname.toLowerCase())) {
    const finalUrl = await resolveFinalRedirectUrl(inputUrl);
    const finalIdentity = resolveVideoIdentityFromUrl(finalUrl);
    if (!finalIdentity || finalIdentity.provider !== "bilibili") {
      throw new RouteError("VIDEO_URL_UNSUPPORTED", 422, "暂不支持该视频链接格式。");
    }

    return captureBilibiliVideoDocument(finalUrl, finalIdentity.id);
  }

  return null;
}

async function captureYoutubeVideoDocument(identity: ResolvedVideoIdentity): Promise<CapturedVideoDocument> {
  const canonicalUrl = buildYoutubeCanonicalUrl(identity.id);
  const watchFetchUrl = new URL(canonicalUrl);
  watchFetchUrl.searchParams.set("hl", "en"); // Ensure English metadata/captions are prioritized

  let rawHtml: string | null = null;
  try {
    rawHtml = await fetchText(watchFetchUrl.toString(), {
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    });
  } catch (error) {
    if (!(error instanceof RouteError) || error.code !== "VIDEO_FETCH_FAILED") {
      throw error;
    }
  }

  const innertubePlayerResponse = rawHtml ? await fetchYoutubePlayerResponseFromInnertube(identity.id, rawHtml) : null;
  const watchPlayerResponse = rawHtml ? extractYoutubePlayerResponse(rawHtml) : null;
  const playerResponse = innertubePlayerResponse ?? watchPlayerResponse;

  const captionTracks = rawHtml
    ? [
        ...extractYoutubeCaptionTracks(innertubePlayerResponse, rawHtml),
        ...extractYoutubeCaptionTracks(watchPlayerResponse, rawHtml),
      ]
    : [];
  const selectedTrack = selectYoutubeCaptionTrack(captionTracks);

  let transcriptSegments: TranscriptSegment[] = [];
  if (selectedTrack?.baseUrl) {
    try {
      const transcriptPayload = await fetchYoutubeTranscriptPayload(selectedTrack.baseUrl);
      transcriptSegments = parseYouTubeTranscriptSegments(transcriptPayload);
    } catch (error) {
      if (!(error instanceof RouteError) || error.code !== "VIDEO_FETCH_FAILED") {
        throw error;
      }
    }
  }

  const resolvedMetadata =
    resolveYoutubeCaptureMetadata(playerResponse, watchPlayerResponse) ??
    (await fetchYoutubeOEmbedMetadata(canonicalUrl));

  if (!resolvedMetadata && transcriptSegments.length === 0) {
    throw new RouteError("VIDEO_METADATA_FETCH_FAILED", 502, "YouTube 页面解析失败。");
  }

  const plainText = transcriptSegments.length > 0 ? buildTranscriptPlainText(transcriptSegments) : "";
  const transcriptStatus = transcriptSegments.length > 0 ? TranscriptStatus.READY : TranscriptStatus.FAILED;
  const transcriptSource = transcriptSegments.length > 0 ? TranscriptSource.NATIVE : TranscriptSource.NONE;

  return buildYoutubeCapturedDocument({
    videoId: identity.id,
    canonicalUrl,
    title: resolvedMetadata?.title ?? "YouTube Video",
    author: resolvedMetadata?.author ?? null,
    lang: transcriptSegments.length > 0 ? selectedTrack?.languageCode ?? null : null,
    excerpt: null,
    plainText,
    publishedAt: resolvedMetadata?.publishedAt ?? null,
    videoThumbnailUrl: resolvedMetadata?.videoThumbnailUrl ?? null,
    videoDurationSeconds: resolvedMetadata?.videoDurationSeconds ?? null,
    transcriptSegments,
    transcriptSource,
    transcriptStatus,
  });
}

async function captureBilibiliVideoDocument(sourceUrl: string, bvid: string): Promise<CapturedVideoDocument> {
  const inputUrl = new URL(sourceUrl);
  const canonicalUrl = `https://www.bilibili.com/video/${bvid}`;
  const viewResponse = await fetchJson<{
    code: number;
    data?: Record<string, unknown>;
  }>(`https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`);
  if (viewResponse.code !== 0 || !viewResponse.data) {
    throw new RouteError("VIDEO_METADATA_FETCH_FAILED", 502, "B 站视频元数据获取失败。");
  }

  const videoData = viewResponse.data;
  const title = readString(videoData, "title") ?? "Bilibili Video";
  const author = readString(readObject(videoData, "owner"), "name");
  const thumbnailUrl = normalizeBilibiliThumbnailUrl(readString(videoData, "pic"));
  const durationSeconds = readNumber(videoData, "duration");
  const publishedAt = parseUnixTime(readNumber(videoData, "pubdate"));
  const cid = resolveBilibiliCid(videoData, inputUrl);

  const metadataOnlyCapture = buildBilibiliCapturedDocument({
    bvid,
    canonicalUrl,
    title,
    author,
    lang: null,
    excerpt: null,
    plainText: "",
    publishedAt,
    videoThumbnailUrl: thumbnailUrl,
    videoDurationSeconds: durationSeconds,
    transcriptSegments: [],
    transcriptSource: TranscriptSource.NONE,
    transcriptStatus: TranscriptStatus.FAILED,
  });

  if (!cid) {
    return metadataOnlyCapture;
  }

  const subtitleResponse = await fetchJson<{
    code: number;
    data?: {
      need_login_subtitle?: unknown;
      subtitle?: {
        subtitles?: Array<{
          lan?: string;
          subtitle_url?: string;
          is_lock?: boolean;
        }>;
      };
    };
  }>(`https://api.bilibili.com/x/player/wbi/v2?bvid=${encodeURIComponent(bvid)}&cid=${cid}`);

  if (subtitleResponse.code !== 0 || !subtitleResponse.data) {
    return metadataOnlyCapture;
  }

  if (subtitleResponse.data.need_login_subtitle === true) {
    return metadataOnlyCapture;
  }

  const selectedSubtitle = selectBilibiliSubtitle(subtitleResponse.data.subtitle?.subtitles ?? []);
  if (!selectedSubtitle?.subtitle_url) {
    return metadataOnlyCapture;
  }

  const subtitleUrl = normalizeBilibiliSubtitleUrl(selectedSubtitle.subtitle_url);
  const subtitlePayload = await fetchJson<{
    body?: Array<{
      from?: number;
      to?: number;
      content?: string;
    }>;
  }>(subtitleUrl);

  const transcriptSegments = normalizeTranscriptSegmentsFromBody(subtitlePayload.body ?? []);
  if (transcriptSegments.length === 0) {
    return metadataOnlyCapture;
  }

  const plainText = buildTranscriptPlainText(transcriptSegments);
  return buildBilibiliCapturedDocument({
    bvid,
    canonicalUrl,
    title,
    author,
    lang: selectedSubtitle.lan ?? null,
    excerpt: plainText.slice(0, 240),
    plainText,
    publishedAt,
    videoThumbnailUrl: thumbnailUrl,
    videoDurationSeconds: durationSeconds,
    transcriptSegments,
    transcriptSource: TranscriptSource.NATIVE,
    transcriptStatus: TranscriptStatus.READY,
  });
}

async function resolveFinalRedirectUrl(url: string) {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      headers: {
        "user-agent": VIDEO_CAPTURE_USER_AGENT,
      },
      signal: AbortSignal.timeout(VIDEO_FETCH_TIMEOUT_MS),
    });
  } catch {
    throw new RouteError("VIDEO_FETCH_FAILED", 502, "视频链接解析失败。");
  }

  if (!response.ok) {
    throw new RouteError("VIDEO_FETCH_FAILED", 502, "视频链接解析失败。");
  }

  response.body?.cancel();
  return response.url || url;
}

async function fetchText(url: string, headers: Record<string, string> = {}) {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      headers: {
        "user-agent": VIDEO_CAPTURE_USER_AGENT,
        ...headers,
      },
      signal: AbortSignal.timeout(VIDEO_FETCH_TIMEOUT_MS),
    });
  } catch {
    throw new RouteError("VIDEO_FETCH_FAILED", 502, "视频内容抓取失败。");
  }

  if (!response.ok) {
    throw new RouteError("VIDEO_FETCH_FAILED", 502, "视频内容抓取失败。");
  }

  return response.text();
}

async function fetchYoutubePlayerResponseFromInnertube(videoId: string, rawHtml: string): Promise<Record<string, unknown> | null> {
  const apiKey = extractYoutubeInnertubeApiKey(rawHtml);
  if (!apiKey) {
    return null;
  }

  let response: Response;
  try {
    response = await fetch(`https://www.youtube.com/youtubei/v1/player?prettyPrint=false&key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      redirect: "follow",
      cache: "no-store",
      headers: {
        "content-type": "application/json; charset=UTF-8",
        "x-goog-api-format-version": "2",
        "x-youtube-client-name": YOUTUBE_IOS_CLIENT_NAME_PROTO,
        "x-youtube-client-version": YOUTUBE_IOS_CLIENT_VERSION,
        "user-agent": YOUTUBE_IOS_USER_AGENT,
      },
      body: JSON.stringify({
        videoId,
        context: {
          client: {
            hl: "en",
            gl: "US",
            clientName: "IOS",
            clientVersion: YOUTUBE_IOS_CLIENT_VERSION,
            deviceMake: "Apple",
            deviceModel: "iPhone14,5",
            osName: "iPhone",
            osVersion: "18.5.0.22F76",
            platform: "MOBILE",
          },
        },
      }),
      signal: AbortSignal.timeout(VIDEO_FETCH_TIMEOUT_MS),
    });
  } catch {
    return null;
  }

  if (!response.ok) {
    return null;
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return null;
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const playabilityStatus = readObject(payload as Record<string, unknown>, "playabilityStatus");
  const status = readString(playabilityStatus, "status");
  if (status && status !== "OK") {
    return null;
  }

  return payload as Record<string, unknown>;
}

async function fetchYoutubeTranscriptPayload(baseUrl: string) {
  const candidateUrls = buildYoutubeTranscriptCandidateUrls(baseUrl);
  for (const candidateUrl of candidateUrls) {
    try {
      const payload = await fetchText(candidateUrl, {
        accept: "text/vtt,application/json,text/xml,application/xml;q=0.9,*/*;q=0.8",
      });
      if (payload.trim()) {
        return payload;
      }
    } catch (error) {
      if (error instanceof RouteError && error.code === "VIDEO_FETCH_FAILED") {
        continue;
      }

      throw error;
    }
  }

  return "";
}

async function fetchJson<T>(url: string): Promise<T> {
  const text = await fetchText(url, {
    accept: "application/json,text/plain;q=0.9,*/*;q=0.8",
    referer: "https://www.bilibili.com/",
  });

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new RouteError("VIDEO_METADATA_FETCH_FAILED", 502, "视频接口返回了无效数据。");
  }
}

function extractYoutubePlayerResponse(rawHtml: string): Record<string, unknown> | null {
  const markers = ["ytInitialPlayerResponse =", "var ytInitialPlayerResponse =", "window['ytInitialPlayerResponse'] ="];

  for (const marker of markers) {
    const objectText = extractJsonObjectAfterMarker(rawHtml, marker);
    if (!objectText) {
      continue;
    }

    try {
      return JSON.parse(objectText) as Record<string, unknown>;
    } catch {
      continue;
    }
  }

  return null;
}

function extractYoutubeInnertubeApiKey(rawHtml: string) {
  for (const pattern of YOUTUBE_INNERTUBE_API_KEY_PATTERNS) {
    const matched = rawHtml.match(pattern);
    if (matched?.[1]) {
      return matched[1];
    }
  }

  return null;
}

function buildYoutubeTranscriptCandidateUrls(baseUrl: string) {
  const candidates = new Set<string>();
  candidates.add(baseUrl);

  try {
    const parsed = new URL(baseUrl);
    for (const format of ["vtt", "json3", "srv3"]) {
      const candidate = new URL(parsed);
      candidate.searchParams.set("fmt", format);
      candidates.add(candidate.toString());
    }
  } catch {
    return [...candidates];
  }

  return [...candidates];
}

function buildYoutubeCanonicalUrl(videoId: string) {
  const url = new URL("https://www.youtube.com/watch");
  url.searchParams.set("v", videoId);
  return url.toString();
}

function buildYoutubeCapturedDocument(input: {
  videoId: string;
  canonicalUrl: string;
  title: string;
  author: string | null;
  lang: string | null;
  excerpt: string | null;
  plainText: string;
  publishedAt: Date | null;
  videoThumbnailUrl: string | null;
  videoDurationSeconds: number | null;
  transcriptSegments: TranscriptSegment[];
  transcriptSource: TranscriptSource;
  transcriptStatus: TranscriptStatus;
}): CapturedVideoDocument {
  const plainText = input.plainText.trim();
  const excerpt = typeof input.excerpt === "string" ? input.excerpt.trim() : plainText.slice(0, 240);

  return {
    provider: "youtube",
    externalId: buildVideoExternalId({
      provider: "youtube",
      id: input.videoId,
    }),
    canonicalUrl: input.canonicalUrl,
    videoUrl: input.canonicalUrl,
    title: input.title,
    author: input.author,
    lang: input.lang,
    excerpt,
    plainText,
    textHash: createHash("sha256").update(plainText).digest("hex"),
    wordCount: countReadableUnits(plainText),
    publishedAt: input.publishedAt,
    videoThumbnailUrl: input.videoThumbnailUrl,
    videoDurationSeconds: input.videoDurationSeconds,
    transcriptSegments: input.transcriptSegments,
    transcriptSource: input.transcriptSource,
    transcriptStatus: input.transcriptStatus,
  };
}

function buildBilibiliCapturedDocument(input: {
  bvid: string;
  canonicalUrl: string;
  title: string;
  author: string | null;
  lang: string | null;
  excerpt: string | null;
  plainText: string;
  publishedAt: Date | null;
  videoThumbnailUrl: string | null;
  videoDurationSeconds: number | null;
  transcriptSegments: TranscriptSegment[];
  transcriptSource: TranscriptSource;
  transcriptStatus: TranscriptStatus;
}): CapturedVideoDocument {
  const plainText = input.plainText.trim();
  const excerpt = typeof input.excerpt === "string" ? input.excerpt.trim() : plainText.slice(0, 240);

  return {
    provider: "bilibili",
    externalId: buildVideoExternalId({
      provider: "bilibili",
      id: input.bvid,
    }),
    canonicalUrl: input.canonicalUrl,
    videoUrl: input.canonicalUrl,
    title: input.title,
    author: input.author,
    lang: input.lang,
    excerpt,
    plainText,
    textHash: createHash("sha256").update(plainText).digest("hex"),
    wordCount: countReadableUnits(plainText),
    publishedAt: input.publishedAt,
    videoThumbnailUrl: input.videoThumbnailUrl,
    videoDurationSeconds: input.videoDurationSeconds,
    transcriptSegments: input.transcriptSegments,
    transcriptSource: input.transcriptSource,
    transcriptStatus: input.transcriptStatus,
  };
}

function resolveYoutubeCaptureMetadata(
  playerResponse: Record<string, unknown> | null,
  watchPlayerResponse: Record<string, unknown> | null,
): YoutubeCaptureMetadata | null {
  const effectivePlayerResponse = playerResponse ?? watchPlayerResponse;
  const videoDetails =
    readObject(effectivePlayerResponse, "videoDetails") ?? readObject(watchPlayerResponse, "videoDetails");
  const microformat =
    readObject(readObject(effectivePlayerResponse, "microformat"), "playerMicroformatRenderer") ??
    readObject(readObject(watchPlayerResponse, "microformat"), "playerMicroformatRenderer");

  const title = readString(videoDetails, "title") ?? readString(microformat, "title");
  if (!title) {
    return null;
  }

  return {
    title,
    author: readString(videoDetails, "author"),
    publishedAt: parseDate(readString(microformat, "publishDate") ?? readString(microformat, "uploadDate")),
    videoThumbnailUrl: resolveYoutubeThumbnailUrl(videoDetails, microformat),
    videoDurationSeconds: parseDurationSeconds(readString(videoDetails, "lengthSeconds")),
  };
}

async function fetchYoutubeOEmbedMetadata(canonicalUrl: string): Promise<YoutubeCaptureMetadata | null> {
  let response: Response;
  try {
    const oEmbedUrl = new URL("https://www.youtube.com/oembed");
    oEmbedUrl.searchParams.set("url", canonicalUrl);
    oEmbedUrl.searchParams.set("format", "json");
    response = await fetch(oEmbedUrl, {
      method: "GET",
      redirect: "follow",
      cache: "no-store",
      headers: {
        accept: "application/json,text/plain;q=0.9,*/*;q=0.8",
        "user-agent": VIDEO_CAPTURE_USER_AGENT,
      },
      signal: AbortSignal.timeout(VIDEO_FETCH_TIMEOUT_MS),
    });
  } catch {
    return null;
  }

  if (!response.ok) {
    return null;
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return null;
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }

  const title = readString(payload as Record<string, unknown>, "title");
  if (!title) {
    return null;
  }

  return {
    title,
    author: readString(payload as Record<string, unknown>, "author_name"),
    publishedAt: null,
    videoThumbnailUrl: readString(payload as Record<string, unknown>, "thumbnail_url"),
    videoDurationSeconds: null,
  };
}

function extractJsonObjectAfterMarker(raw: string, marker: string) {
  const markerIndex = raw.indexOf(marker);
  if (markerIndex < 0) {
    return null;
  }

  const objectStart = raw.indexOf("{", markerIndex + marker.length);
  if (objectStart < 0) {
    return null;
  }

  return readBalancedJsonObject(raw, objectStart);
}

function readBalancedJsonObject(raw: string, startIndex: number) {
  let depth = 0;
  let inString = false;
  let quoteChar: '"' | "'" | null = null;
  let escaped = false;

  for (let index = startIndex; index < raw.length; index += 1) {
    const char = raw[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === "\\") {
        escaped = true;
        continue;
      }

      if (char === quoteChar) {
        inString = false;
        quoteChar = null;
      }

      continue;
    }

    if (char === '"' || char === "'") {
      inString = true;
      quoteChar = char;
      continue;
    }

    if (char === "{") {
      depth += 1;
      continue;
    }

    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return raw.slice(startIndex, index + 1);
      }
    }
  }

  return null;
}

function extractYoutubeCaptionTracks(playerResponse: Record<string, unknown> | null, rawHtml?: string): YoutubeCaptionTrack[] {
  const captions = readObject(playerResponse, "captions");
  const trackListRenderer = readObject(captions, "playerCaptionsTracklistRenderer");
  let tracks = trackListRenderer?.captionTracks;

  if (!Array.isArray(tracks)) {
    const captionsRenderer = readObject(captions, "playerCaptionsRenderer");
    tracks = captionsRenderer?.captionTracks;
  }

  if (!Array.isArray(tracks) && rawHtml) {
    const match = rawHtml.match(/"captionTracks":\s*(\[[^\]]+\])/);
    if (match?.[1]) {
      try {
        tracks = JSON.parse(match[1]);
      } catch {}
    }
  }

  if (!Array.isArray(tracks)) {
    return [];
  }

  return tracks
    .filter((item): item is YoutubeCaptionTrack => Boolean(item && typeof item === "object"))
    .map((item) => ({
      baseUrl: typeof item.baseUrl === "string" ? item.baseUrl : undefined,
      languageCode: typeof item.languageCode === "string" ? item.languageCode : undefined,
      kind: typeof item.kind === "string" ? item.kind : undefined,
    }));
}

function selectYoutubeCaptionTrack(tracks: YoutubeCaptionTrack[]) {
  if (tracks.length === 0) {
    return null;
  }

  return tracks
    .map((track, index) => ({
      track,
      index,
      score: resolveYoutubeCaptionLanguageScore(track.languageCode) + (track.kind === "asr" ? 10 : 0),
    }))
    .sort((left, right) => left.score - right.score || left.index - right.index)[0]?.track ?? null;
}

function resolveYoutubeCaptionLanguageScore(languageCode: string | undefined) {
  if (!languageCode) {
    return 4;
  }

  const normalized = languageCode.toLowerCase();
  if (normalized.startsWith("zh")) {
    return 0;
  }

  if (normalized.startsWith("en")) {
    return 1;
  }

  return 2;
}

function parseYouTubeTranscriptSegments(payload: string): TranscriptSegment[] {
  const trimmed = payload.trim();
  if (!trimmed) {
    return [];
  }

  let segments: TranscriptSegment[] = [];
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    segments = parseJson3Segments(trimmed);
    return normalizeTranscriptTimeline(segments);
  }

  if (trimmed.startsWith("WEBVTT")) {
    segments = parseWebVttSegments(trimmed);
    return normalizeTranscriptTimeline(segments);
  }

  if (trimmed.startsWith("<")) {
    segments = parseTimedTextSegments(trimmed);
    return normalizeTranscriptTimeline(segments);
  }

  return [];
}

function parseJson3Segments(payload: string): TranscriptSegment[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(payload);
  } catch {
    return [];
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return [];
  }

  const events = (parsed as { events?: unknown }).events;
  if (!Array.isArray(events)) {
    return [];
  }

  const segments: TranscriptSegment[] = [];
  for (const event of events) {
    if (!event || typeof event !== "object" || Array.isArray(event)) {
      continue;
    }

    const record = event as {
      tStartMs?: unknown;
      dDurationMs?: unknown;
      segs?: unknown;
    };

    const startMs = typeof record.tStartMs === "number" ? record.tStartMs : Number.NaN;
    if (!Number.isFinite(startMs) || startMs < 0) {
      continue;
    }

    const segs = Array.isArray(record.segs) ? record.segs : [];
    const text = normalizeSubtitleText(
      segs
        .map((segment) => {
          if (!segment || typeof segment !== "object" || Array.isArray(segment)) {
            return "";
          }

          const utf8 = (segment as { utf8?: unknown }).utf8;
          return typeof utf8 === "string" ? utf8 : "";
        })
        .join(""),
    );

    if (!text) {
      continue;
    }

    const durationMs = typeof record.dDurationMs === "number" ? record.dDurationMs : Number.NaN;
    const start = startMs / 1000;
    const end = Number.isFinite(durationMs) && durationMs > 0 ? (startMs + durationMs) / 1000 : start + 2;
    if (end <= start) {
      continue;
    }

    segments.push({
      start,
      end,
      text,
    });
  }

  return segments;
}

function normalizeTranscriptTimeline(segments: TranscriptSegment[]) {
  if (segments.length === 0) {
    return [];
  }

  const normalized = segments
    .filter((segment) => Number.isFinite(segment.start) && Number.isFinite(segment.end) && segment.end > segment.start)
    .map((segment) => ({
      start: segment.start,
      end: segment.end,
      text: normalizeSubtitleText(segment.text),
    }))
    .filter((segment) => segment.text)
    .sort((left, right) => left.start - right.start || left.end - right.end);

  for (let index = 0; index < normalized.length - 1; index += 1) {
    const current = normalized[index];
    const next = normalized[index + 1];
    if (next && current.end > next.start && next.start > current.start) {
      current.end = next.start;
    }
  }

  return normalized.filter((segment) => segment.end > segment.start);
}

function parseTimedTextSegments(xml: string): TranscriptSegment[] {
  const $ = load(xml, { xmlMode: true });
  const segments: TranscriptSegment[] = [];

  for (const node of $("text").toArray()) {
    const start = Number.parseFloat($(node).attr("start") ?? "");
    const duration = Number.parseFloat($(node).attr("dur") ?? "");
    const text = normalizeSubtitleText($(node).text());

    if (!Number.isFinite(start) || start < 0 || !text) {
      continue;
    }

    const end = Number.isFinite(duration) && duration > 0 ? start + duration : start + 2;
    segments.push({
      start,
      end,
      text,
    });
  }

  return segments;
}

function parseWebVttSegments(vtt: string): TranscriptSegment[] {
  const lines = vtt.replace(/\r\n/g, "\n").split("\n");
  const segments: TranscriptSegment[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index]?.trim() ?? "";
    if (!line || line === "WEBVTT" || line.startsWith("NOTE")) {
      index += 1;
      continue;
    }

    let timingLine = line;
    if (!timingLine.includes("-->")) {
      index += 1;
      timingLine = lines[index]?.trim() ?? "";
    }

    if (!timingLine.includes("-->")) {
      index += 1;
      continue;
    }

    const [startPart, endPart] = timingLine.split("-->");
    const start = parseVttTimestamp(startPart?.trim() ?? "");
    const end = parseVttTimestamp((endPart?.trim() ?? "").split(/\s+/)[0] ?? "");
    index += 1;

    const textLines: string[] = [];
    while (index < lines.length && lines[index]?.trim()) {
      textLines.push(lines[index] ?? "");
      index += 1;
    }

    const text = normalizeSubtitleText(textLines.join(" "));
    if (start !== null && end !== null && end > start && text) {
      segments.push({
        start,
        end,
        text,
      });
    }
  }

  return segments;
}

function parseVttTimestamp(value: string): number | null {
  const parts = value.split(":");
  if (parts.length < 2 || parts.length > 3) {
    return null;
  }

  const numericParts = parts.map((part) => Number.parseFloat(part));
  if (numericParts.some((part) => !Number.isFinite(part))) {
    return null;
  }

  if (numericParts.length === 2) {
    return numericParts[0] * 60 + numericParts[1];
  }

  return numericParts[0] * 3600 + numericParts[1] * 60 + numericParts[2];
}

function normalizeSubtitleText(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim();
}

function buildTranscriptPlainText(segments: TranscriptSegment[]) {
  const plainText = segments.map((segment) => segment.text).join("\n");
  if (!plainText.trim()) {
    throw new RouteError("VIDEO_SUBTITLE_UNAVAILABLE", 422, "该视频暂时没有可用字幕，无法导入。");
  }

  return plainText;
}

function resolveYoutubeThumbnailUrl(videoDetails: Record<string, unknown> | null, microformat: Record<string, unknown> | null) {
  const videoDetailsThumbnail = readThumbnailUrl(readObject(videoDetails, "thumbnail"));
  if (videoDetailsThumbnail) {
    return videoDetailsThumbnail;
  }

  return readThumbnailUrl(readObject(microformat, "thumbnail"));
}

function readThumbnailUrl(value: Record<string, unknown> | null): string | null {
  const thumbnails = value?.thumbnails;
  if (!Array.isArray(thumbnails)) {
    return null;
  }

  for (let index = thumbnails.length - 1; index >= 0; index -= 1) {
    const url = readString(thumbnails[index] as Record<string, unknown> | null, "url");
    if (url) {
      return url;
    }
  }

  return null;
}

function resolveBilibiliCid(videoData: Record<string, unknown>, inputUrl: URL): number | null {
  const pages = Array.isArray(videoData.pages) ? videoData.pages : [];
  const pageNumber = Number.parseInt(inputUrl.searchParams.get("p") ?? "", 10);
  if (Number.isSafeInteger(pageNumber) && pageNumber > 0 && pageNumber <= pages.length) {
    const page = pages[pageNumber - 1];
    const cid = readNumber(page as Record<string, unknown> | null, "cid");
    if (cid !== null) {
      return cid;
    }
  }

  const directCid = readNumber(videoData, "cid");
  if (directCid !== null) {
    return directCid;
  }

  for (const page of pages) {
    const cid = readNumber(page as Record<string, unknown> | null, "cid");
    if (cid !== null) {
      return cid;
    }
  }

  return null;
}

function selectBilibiliSubtitle(
  subtitles: Array<{
    lan?: string;
    subtitle_url?: string;
    is_lock?: boolean;
  }>,
) {
  if (!Array.isArray(subtitles) || subtitles.length === 0) {
    return null;
  }

  return subtitles
    .filter((item) => !item.is_lock)
    .map((subtitle, index) => ({
      subtitle,
      index,
      score: resolveBilibiliSubtitleLanguageScore(subtitle.lan),
    }))
    .sort((left, right) => left.score - right.score || left.index - right.index)[0]?.subtitle ?? null;
}

function resolveBilibiliSubtitleLanguageScore(value: string | undefined) {
  if (!value) {
    return 2;
  }

  const normalized = value.toLowerCase();
  if (normalized.startsWith("zh")) {
    return 0;
  }

  return 1;
}

function normalizeBilibiliSubtitleUrl(url: string) {
  if (url.startsWith("//")) {
    return `https:${url}`;
  }

  try {
    return new URL(url).toString();
  } catch {
    return new URL(url, "https://www.bilibili.com").toString();
  }
}

function normalizeBilibiliThumbnailUrl(url: string | null) {
  if (!url) {
    return null;
  }

  if (url.startsWith("//")) {
    return `https:${url}`;
  }

  return url;
}

function normalizeTranscriptSegmentsFromBody(
  body: Array<{
    from?: number;
    to?: number;
    content?: string;
  }>,
): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];

  for (const item of body) {
    const start = typeof item.from === "number" ? item.from : Number.NaN;
    const end = typeof item.to === "number" ? item.to : Number.NaN;
    const text = normalizeSubtitleText(typeof item.content === "string" ? item.content : "");

    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || !text) {
      continue;
    }

    segments.push({
      start,
      end,
      text,
    });
  }

  return segments;
}

function countReadableUnits(value: string) {
  const normalized = value.trim();
  if (!normalized) {
    return 0;
  }

  const cjkCount = normalized.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/gu)?.length ?? 0;
  const wordCount = normalized.match(/[A-Za-z0-9]+(?:[’'_:-][A-Za-z0-9]+)*/g)?.length ?? 0;
  return cjkCount + wordCount;
}

function parseDate(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseUnixTime(value: number | null) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return null;
  }

  return new Date(value * 1000);
}

function parseDurationSeconds(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function readObject(value: Record<string, unknown> | null | undefined, key: string): Record<string, unknown> | null {
  if (!value) {
    return null;
  }

  const nested = value[key];
  return nested && typeof nested === "object" && !Array.isArray(nested) ? (nested as Record<string, unknown>) : null;
}

function readString(value: Record<string, unknown> | null | undefined, key: string): string | null {
  if (!value) {
    return null;
  }

  const field = value[key];
  return typeof field === "string" && field.trim() ? field.trim() : null;
}

function readNumber(value: Record<string, unknown> | null | undefined, key: string): number | null {
  if (!value) {
    return null;
  }

  const field = value[key];
  if (typeof field === "number" && Number.isFinite(field)) {
    return field;
  }

  if (typeof field === "string") {
    const parsed = Number.parseFloat(field);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function safeParseUrl(value: string) {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

export const __videoCaptureForTests = {
  buildYoutubeCapturedDocument,
  buildYoutubeTranscriptCandidateUrls,
  extractJsonObjectAfterMarker,
  extractYoutubeInnertubeApiKey,
  extractYoutubeCaptionTracks,
  normalizeBilibiliSubtitleUrl,
  normalizeTranscriptSegmentsFromBody,
  parseJson3Segments,
  parseTimedTextSegments,
  parseWebVttSegments,
  parseYouTubeTranscriptSegments,
  resolveBilibiliCid,
  resolveYoutubeCaptionLanguageScore,
  selectBilibiliSubtitle,
  selectYoutubeCaptionTrack,
};
