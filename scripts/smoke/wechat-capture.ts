import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import { userInfo } from "node:os";
import { join } from "node:path";
import { parseEnv } from "node:util";
import { setTimeout as sleep } from "node:timers/promises";
import { encode } from "next-auth/jwt";

type CaptureResponse = {
  ok: true;
  data: {
    document: {
      id: string;
      title: string;
      sourceUrl: string | null;
      canonicalUrl: string | null;
      aiSummary: string | null;
      aiSummaryStatus: string | null;
      ingestionStatus: string;
      isFavorite: boolean;
      content: {
        plainText: string;
        contentHtml: string | null;
      } | null;
    };
  };
};

type DocumentResponse = {
  ok: true;
  data: {
    document: {
      id: string;
      title: string;
      ingestionStatus: string;
      aiSummary: string | null;
      aiSummaryStatus: string | null;
      aiSummaryError: string | null;
      isFavorite: boolean;
      sourceUrl: string | null;
      content: {
        plainText: string;
        contentHtml: string | null;
      } | null;
    };
  };
};

type SummaryHealthResponse = {
  ok: true;
  data: {
    ok: boolean;
    issues: string[];
  };
};

type SmokeSample = {
  key: "normal" | "share-shell" | "migration";
  url: string;
  expectedTitle?: string;
  expectedIngestionStatus: "READY" | "FAILED";
};

const SESSION_COOKIE_NAME = "authjs.session-token";
const TEST_EMAIL = "test@example.com";
const TEST_NAME = "Reader Smoke";
const SERVER_READY_TIMEOUT_MS = 30_000;
const SAMPLES: SmokeSample[] = [
  {
    key: "normal",
    url: "https://mp.weixin.qq.com/s/fs6QGr7FHSMEfi6_w5IPZQ",
    expectedTitle: "一人IP公司的诅咒",
    expectedIngestionStatus: "READY",
  },
  {
    key: "share-shell",
    url: "https://mp.weixin.qq.com/s/sBzRsu6YLMBACOr-BZshMg",
    expectedIngestionStatus: "FAILED",
  },
  {
    key: "migration",
    url: "https://mp.weixin.qq.com/s/51iYLcQwh7r31UN3jSkcPQ",
    expectedIngestionStatus: "FAILED",
  },
];

async function main() {
  const env = loadRuntimeEnv();
  const port = await findAvailablePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const sessionToken = await createSessionToken(env.AUTH_SECRET);
  const server = await startServer({
    ...env,
    PORT: String(port),
    HOSTNAME: "127.0.0.1",
  });

  try {
    await waitForServer(baseUrl, sessionToken);

    const suffix = `smoke-${Date.now().toString(36)}`;
    const captures = [];

    for (const sample of SAMPLES) {
      const url = withSuffix(sample.url, suffix, sample.key);
      const capture = await captureDocument(baseUrl, sessionToken, url);
      captures.push({
        sample,
        url,
        documentId: capture.data.document.id,
      });
    }

    const libraryHtml = await getHtml(baseUrl, sessionToken, `/library?q=${encodeURIComponent(suffix)}`);
    assert.match(libraryHtml, /Capture failed/);

    let normalDocumentId: string | null = null;
    let normalSummaryText: string | null = null;
    let healthIssues: string[] = [];

    for (const capture of captures) {
      const document = await getDocument(baseUrl, sessionToken, capture.documentId);
      assert.equal(document.data.document.ingestionStatus, capture.sample.expectedIngestionStatus);

      const readerHtml = await getHtml(baseUrl, sessionToken, `/documents/${capture.documentId}`);
      assert.match(readerHtml, new RegExp(capture.documentId));

      if (capture.sample.expectedIngestionStatus === "READY") {
        normalDocumentId = capture.documentId;
        assert.equal(document.data.document.title, capture.sample.expectedTitle);
        assert.ok(document.data.document.content?.plainText.trim().length);
        assert.ok(document.data.document.content?.contentHtml?.trim().length);
        assert.doesNotMatch(readerHtml, /Stored, but not readable yet\./);
        assert.doesNotMatch(readerHtml, /Capture failed/);
        assert.match(readerHtml, /一人IP公司的诅咒/);
      } else {
        assert.equal(document.data.document.content, null);
        assert.equal(document.data.document.aiSummaryStatus, null);
        assert.match(readerHtml, /Stored, but not readable yet\./);
        assert.match(readerHtml, /Capture failed/);
      }
    }

    assert.ok(normalDocumentId, "Expected a normal document capture result.");

    const health = await getSummaryHealth(baseUrl, sessionToken);
    healthIssues = health.data.issues;

    const normalDocument = await getDocument(baseUrl, sessionToken, normalDocumentId);
    assert.equal(normalDocument.data.document.isFavorite, false);

    if (health.data.ok) {
      assert.equal(normalDocument.data.document.aiSummaryStatus, "READY");
      assert.ok(normalDocument.data.document.aiSummary);
      normalSummaryText = normalDocument.data.document.aiSummary;
    }

    const updatedLibraryHtml = await getHtml(baseUrl, sessionToken, `/library?q=${encodeURIComponent(suffix)}`);
    assert.match(updatedLibraryHtml, /一人IP公司的诅咒/);
    assert.match(updatedLibraryHtml, /Capture failed/);

    if (normalSummaryText) {
      assert.match(updatedLibraryHtml, new RegExp(escapeRegExp(normalSummaryText)));
    }

    console.log("");
    console.log("WeChat smoke results");
    console.table(
      await Promise.all(
        captures.map(async ({ sample, documentId }) => {
          const document = await getDocument(baseUrl, sessionToken, documentId);
          return {
            sample: sample.key,
            documentId,
            ingestionStatus: document.data.document.ingestionStatus,
            aiSummaryStatus: document.data.document.aiSummaryStatus,
          };
        }),
      ),
    );

    if (!health.data.ok) {
      console.log("Summary health issues:", healthIssues.join("; "));
    }
  } catch (error) {
    const serverLogs = server.logs.join("");
    if (serverLogs.trim()) {
      console.error("Smoke server logs:");
      console.error(serverLogs);
    }
    throw error;
  } finally {
    await stopServer(server);
  }
}

function loadRuntimeEnv() {
  const fileEnv = {
    ...readEnvFile(".env"),
    ...readEnvFile(".env.local"),
  };
  const merged = {
    ...fileEnv,
    ...process.env,
  };

  const allowedEmails = new Set(
    (merged.ALLOWED_EMAILS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
  allowedEmails.add(TEST_EMAIL);

  const databaseUrl = resolveSmokeDatabaseUrl(merged);
  if (!databaseUrl) {
    throw new Error("No usable database URL was found. Set SMOKE_DATABASE_URL or ensure a local reader_app database is available.");
  }

  return {
    DATABASE_URL: databaseUrl,
    AUTH_SECRET: merged.AUTH_SECRET?.trim() || "reader-smoke-auth-secret",
    AUTH_GITHUB_ID: merged.AUTH_GITHUB_ID?.trim() || "dummy",
    AUTH_GITHUB_SECRET: merged.AUTH_GITHUB_SECRET?.trim() || "dummy",
    ALLOWED_EMAILS: [...allowedEmails].join(","),
    INTERNAL_API_SECRET: merged.INTERNAL_API_SECRET?.trim() || "reader-smoke-internal-secret",
    AI_PROVIDER: merged.AI_PROVIDER?.trim() || "",
    GEMINI_API_KEY: merged.GEMINI_API_KEY?.trim() || "",
    GEMINI_BASE_URL: merged.GEMINI_BASE_URL?.trim() || "",
    GEMINI_MODEL: merged.GEMINI_MODEL?.trim() || "",
    OPENAI_API_KEY: merged.OPENAI_API_KEY?.trim() || "",
    OPENAI_BASE_URL: merged.OPENAI_BASE_URL?.trim() || "",
    OPENAI_MODEL: merged.OPENAI_MODEL?.trim() || "",
  };
}

function resolveSmokeDatabaseUrl(env: Record<string, string | undefined>) {
  const explicitSmokeUrl = env.SMOKE_DATABASE_URL?.trim();
  if (explicitSmokeUrl) {
    return explicitSmokeUrl;
  }

  const configuredDatabaseUrl = env.DATABASE_URL?.trim();
  if (configuredDatabaseUrl && isLocalDatabaseUrl(configuredDatabaseUrl)) {
    return configuredDatabaseUrl;
  }

  return `postgresql://${userInfo().username}@localhost:5432/reader_app?schema=public`;
}

function isLocalDatabaseUrl(value: string) {
  try {
    const url = new URL(value);
    return url.hostname === "localhost" || url.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

function readEnvFile(fileName: string) {
  const filePath = join(process.cwd(), fileName);
  if (!existsSync(filePath)) {
    return {};
  }

  return parseEnv(readFileSync(filePath, "utf8"));
}

async function findAvailablePort() {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();
  await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  if (!address || typeof address === "string") {
    throw new Error("Failed to allocate a local port for smoke testing.");
  }

  return address.port;
}

async function createSessionToken(secret: string) {
  return encode({
    secret,
    salt: SESSION_COOKIE_NAME,
    token: {
      sub: TEST_EMAIL,
      email: TEST_EMAIL,
      name: TEST_NAME,
      picture: null,
    },
  });
}

async function startServer(env: Record<string, string>) {
  const entrypoint = join(process.cwd(), ".next/standalone/server.js");
  if (!existsSync(entrypoint)) {
    throw new Error('Build output ".next/standalone/server.js" was not found. Run "npm run build" first.');
  }

  const logs: string[] = [];
  const child = spawn(process.execPath, [entrypoint], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  child.stdout.on("data", (chunk) => {
    logs.push(chunk.toString());
    trimLogs(logs);
  });
  child.stderr.on("data", (chunk) => {
    logs.push(chunk.toString());
    trimLogs(logs);
  });

  child.once("exit", (code) => {
    if (code && code !== 0) {
      console.error(`Smoke server exited early with code ${code}.`);
      console.error(logs.join(""));
    }
  });

  return { child, logs };
}

async function stopServer(server: { child: ChildProcess }) {
  if (server.child.exitCode !== null) {
    return;
  }

  server.child.kill("SIGINT");
  await Promise.race([
    new Promise<void>((resolve) => server.child.once("exit", () => resolve())),
    sleep(3_000),
  ]);

  if (server.child.exitCode === null) {
    server.child.kill("SIGKILL");
  }
}

async function waitForServer(baseUrl: string, sessionToken: string) {
  const deadline = Date.now() + SERVER_READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/login`, {
        headers: {
          cookie: cookieHeader(sessionToken),
        },
      });
      if (response.ok) {
        return;
      }
    } catch {}

    await sleep(500);
  }

  throw new Error("Local smoke server did not become ready in time.");
}

async function captureDocument(baseUrl: string, sessionToken: string, url: string) {
  return postJson<CaptureResponse>(baseUrl, sessionToken, "/api/capture/url", { url });
}

async function getDocument(baseUrl: string, sessionToken: string, id: string) {
  return getJson<DocumentResponse>(baseUrl, sessionToken, `/api/documents/${id}`);
}

async function getSummaryHealth(baseUrl: string, sessionToken: string) {
  return getJson<SummaryHealthResponse>(baseUrl, sessionToken, "/api/internal/summary-jobs/health");
}

async function getHtml(baseUrl: string, sessionToken: string, path: string) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      cookie: cookieHeader(sessionToken),
    },
  });

  if (!response.ok) {
    throw new Error(`Expected HTML response for ${path}, received ${response.status}.`);
  }

  return response.text();
}

async function getJson<T>(baseUrl: string, sessionToken: string, path: string) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      cookie: cookieHeader(sessionToken),
    },
  });

  if (!response.ok) {
    throw new Error(`GET ${path} failed with ${response.status}: ${await response.text()}`);
  }

  return (await response.json()) as T;
}

async function postJson<T>(baseUrl: string, sessionToken: string, path: string, body: unknown) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      cookie: cookieHeader(sessionToken),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`POST ${path} failed with ${response.status}: ${await response.text()}`);
  }

  return (await response.json()) as T;
}

function withSuffix(url: string, suffix: string, sample: string) {
  const next = new URL(url);
  next.searchParams.set("qa_smoke", suffix);
  next.searchParams.set("sample", sample);
  return next.toString();
}

function cookieHeader(sessionToken: string) {
  return `${SESSION_COOKIE_NAME}=${sessionToken}`;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function trimLogs(logs: string[]) {
  if (logs.length > 20) {
    logs.splice(0, logs.length - 20);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
