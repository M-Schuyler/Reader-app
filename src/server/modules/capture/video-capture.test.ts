import assert from "node:assert/strict";
import test from "node:test";
import { __videoCaptureForTests, isVideoCaptureCandidate, resolveVideoExternalIdHint } from "./video-capture";

test("video capture candidate detection covers youtube and bilibili hosts", () => {
  assert.equal(isVideoCaptureCandidate("https://youtu.be/VIIIP_uNGSU"), true);
  assert.equal(isVideoCaptureCandidate("https://www.youtube.com/watch?v=VIIIP_uNGSU"), true);
  assert.equal(isVideoCaptureCandidate("https://www.bilibili.com/video/BV1xx411c7mD"), true);
  assert.equal(isVideoCaptureCandidate("https://b23.tv/abcd"), true);
  assert.equal(isVideoCaptureCandidate("https://example.com/article"), false);
});

test("video external id hint follows provider:id format", () => {
  assert.equal(resolveVideoExternalIdHint("https://youtu.be/VIIIP_uNGSU"), "youtube:VIIIP_uNGSU");
  assert.equal(resolveVideoExternalIdHint("https://www.bilibili.com/video/BV1xx411c7mD"), "bilibili:BV1xx411c7mD");
});

test("youtube caption track selection prioritizes chinese over english and auto generated tracks", () => {
  const selected = __videoCaptureForTests.selectYoutubeCaptionTrack([
    { baseUrl: "https://example.com/en", languageCode: "en" },
    { baseUrl: "https://example.com/zh-auto", languageCode: "zh-CN", kind: "asr" },
    { baseUrl: "https://example.com/zh-manual", languageCode: "zh-CN" },
  ]);

  assert.deepEqual(selected, {
    baseUrl: "https://example.com/zh-manual",
    languageCode: "zh-CN",
  });
});

test("youtube transcript parser supports timed text xml, webvtt and json3", () => {
  const fromXml = __videoCaptureForTests.parseYouTubeTranscriptSegments(`
    <transcript>
      <text start="0.0" dur="1.5">Hello</text>
      <text start="1.5" dur="2.0">World</text>
    </transcript>
  `);
  assert.equal(fromXml.length, 2);
  assert.equal(fromXml[0]?.text, "Hello");
  assert.equal(fromXml[1]?.end, 3.5);

  const fromVtt = __videoCaptureForTests.parseYouTubeTranscriptSegments(`
WEBVTT

00:00:00.000 --> 00:00:01.000
First line

00:00:01.500 --> 00:00:03.000
Second line
  `);
  assert.equal(fromVtt.length, 2);
  assert.equal(fromVtt[0]?.text, "First line");
  assert.equal(fromVtt[1]?.start, 1.5);

  const fromJson3 = __videoCaptureForTests.parseYouTubeTranscriptSegments(`
{
  "events": [
    { "tStartMs": 0, "dDurationMs": 1000, "segs": [{ "utf8": "Hello " }, { "utf8": "world" }] },
    { "tStartMs": 1200, "dDurationMs": 900, "segs": [{ "utf8": "Again" }] }
  ]
}
  `);
  assert.equal(fromJson3.length, 2);
  assert.equal(fromJson3[0]?.text, "Hello world");
  assert.equal(fromJson3[1]?.start, 1.2);
});

test("youtube transcript candidate urls include json3 fallback", () => {
  const urls = __videoCaptureForTests.buildYoutubeTranscriptCandidateUrls(
    "https://www.youtube.com/api/timedtext?v=abc&lang=en",
  );
  assert.equal(urls[0], "https://www.youtube.com/api/timedtext?v=abc&lang=en");
  assert.equal(urls.some((url) => url.includes("fmt=json3")), true);
});

test("youtube metadata-only capture stays importable without pretending AI text is a subtitle", () => {
  const captured = __videoCaptureForTests.buildYoutubeCapturedDocument({
    videoId: "svquts376lo",
    canonicalUrl: "https://www.youtube.com/watch?v=svquts376lo",
    title: "Learn English in Nature | Comprehensible Input for Beginners",
    author: "Volka English",
    lang: null,
    excerpt: null,
    plainText: "",
    publishedAt: null,
    videoThumbnailUrl: "https://i.ytimg.com/vi/svquts376lo/hqdefault.jpg",
    videoDurationSeconds: null,
    transcriptSegments: [],
    transcriptSource: "NONE",
    transcriptStatus: "FAILED",
  });

  assert.equal(captured.provider, "youtube");
  assert.equal(captured.title, "Learn English in Nature | Comprehensible Input for Beginners");
  assert.equal(captured.author, "Volka English");
  assert.equal(captured.wordCount, 0);
  assert.equal(captured.plainText, "");
  assert.equal(captured.excerpt, "");
  assert.deepEqual(captured.transcriptSegments, []);
  assert.equal(captured.transcriptSource, "NONE");
  assert.equal(captured.transcriptStatus, "FAILED");
});

test("youtube innertube api key extractor supports both patterns", () => {
  assert.equal(
    __videoCaptureForTests.extractYoutubeInnertubeApiKey('{"INNERTUBE_API_KEY":"AIzaExample"}'),
    "AIzaExample",
  );
  assert.equal(
    __videoCaptureForTests.extractYoutubeInnertubeApiKey('{"innertubeApiKey":"AIzaExample2"}'),
    "AIzaExample2",
  );
});

test("bilibili helpers normalize subtitle url and prefer chinese subtitle", () => {
  assert.equal(__videoCaptureForTests.normalizeBilibiliSubtitleUrl("//i0.hdslb.com/subtitle.json"), "https://i0.hdslb.com/subtitle.json");

  const selected = __videoCaptureForTests.selectBilibiliSubtitle([
    { lan: "en", subtitle_url: "https://example.com/en.json" },
    { lan: "zh-CN", subtitle_url: "https://example.com/zh.json" },
  ]);
  assert.deepEqual(selected, {
    lan: "zh-CN",
    subtitle_url: "https://example.com/zh.json",
  });
});

test("bilibili cid resolver prefers explicit page number from url", () => {
  const cid = __videoCaptureForTests.resolveBilibiliCid(
    {
      pages: [{ cid: 11 }, { cid: 22 }],
      cid: 11,
    },
    new URL("https://www.bilibili.com/video/BV1xx411c7mD?p=2"),
  );

  assert.equal(cid, 22);
});
