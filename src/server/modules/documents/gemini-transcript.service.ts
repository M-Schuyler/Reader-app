import { RouteError } from "@/server/api/response";
import type { TranscriptSegment } from "@/lib/documents/video-types";

const DEFAULT_GEMINI_TRANSCRIPT_MODEL = "gemini-flash-latest";
const GEMINI_TRANSCRIPT_TIMEOUT_MS = 60_000;

export async function generateGeminiTranscript(videoUrl: string, title: string) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new RouteError("GEMINI_API_KEY_NOT_CONFIGURED", 503, "GEMINI_API_KEY is not configured.");
  }

  const model = process.env.GEMINI_TRANSCRIPT_MODEL?.trim() || DEFAULT_GEMINI_TRANSCRIPT_MODEL;
  const baseUrl = "https://generativelanguage.googleapis.com/v1beta";
  const url = `${baseUrl}/models/${model}:generateContent?key=${apiKey}`;

  const payload = {
    contents: [
      {
        parts: [
          {
            text: `Fetch the transcript for this YouTube video (Title: ${title}) and output it as JSON: ${videoUrl}. The JSON should have a 'language' and 'segments' array with 'startSeconds', 'endSeconds', and 'text'.`,
          },
        ],
      },
    ],
    generationConfig: {
      response_mime_type: "application/json",
    },
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-client": "reader-app-v1",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(GEMINI_TRANSCRIPT_TIMEOUT_MS),
    });

    if (!response.ok) {
      const errorData = (await response.json().catch(() => ({}))) as any;
      throw new RouteError(
        "GEMINI_TRANSCRIPT_REQUEST_FAILED",
        response.status,
        errorData.error?.message || "Gemini transcript request failed.",
      );
    }

    const data = (await response.json()) as any;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new RouteError("GEMINI_TRANSCRIPT_EMPTY", 502, "Gemini transcript returned empty content.");
    }

    const parsed = JSON.parse(text);
    return normalizeGeminiTranscript(parsed);
  } catch (error) {
    if (error instanceof RouteError) throw error;
    
    const message = error instanceof Error ? error.message : "Unknown error during Gemini transcript generation";
    throw new RouteError("GEMINI_TRANSCRIPT_FAILED", 502, message);
  }
}

function normalizeGeminiTranscript(data: any) {
  const segments: TranscriptSegment[] = [];
  if (!data || typeof data !== "object" || !Array.isArray(data.segments)) {
    return { language: data?.language || null, segments: [] };
  }

  for (const item of data.segments) {
    const start = Number(item.startSeconds);
    const end = Number(item.endSeconds);
    const text = String(item.text || "").trim();

    if (Number.isFinite(start) && Number.isFinite(end) && end > start && text) {
      segments.push({ start, end, text });
    }
  }

  // Sort and trim overlaps
  const sorted = segments.sort((a, b) => a.start - b.start);
  const result: TranscriptSegment[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i]!;
    if (result.length > 0) {
      const last = result[result.length - 1]!;
      if (current.start < last.end) {
        // Trim overlap
        current.start = last.end;
      }
    }
    if (current.end > current.start) {
      result.push(current);
    }
  }

  return {
    language: String(data.language || "").trim() || null,
    segments: result,
  };
}
