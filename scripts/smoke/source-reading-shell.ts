import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import { userInfo } from "node:os";
import { join, resolve } from "node:path";
import { parseEnv } from "node:util";
import { setTimeout as sleep } from "node:timers/promises";
import { encode } from "next-auth/jwt";
import { chromium } from "playwright";
import { PrismaClient, DocumentType, IngestionStatus, PublishedAtKind, ReadState } from "@prisma/client";

const SESSION_COOKIE_NAME = "authjs.session-token";
const TEST_EMAIL = "test@example.com";
const TEST_NAME = "Reader Source/Reading Smoke";

async function main() {
  const env = loadRuntimeEnv();
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: env.DATABASE_URL,
      },
    },
  });

  const smokeId = `source-reading-smoke-${Date.now().toString(36)}`;
  const port = await findAvailablePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const sessionToken = await createSessionToken(env.AUTH_SECRET);
  const screenshotPath = resolve(process.cwd(), ".qa-artifacts", "source-reading-shell-smoke.png");
  const server = await startServer({
    ...env,
    PORT: String(port),
    HOSTNAME: "127.0.0.1",
  });

  try {
    await waitForServer(baseUrl, sessionToken);

    const sourceDocument = await prisma.document.create({
      data: {
        type: DocumentType.WEB_PAGE,
        title: `Smoke Source Document ${smokeId}`,
        sourceUrl: `https://example.com/${smokeId}`,
        canonicalUrl: `https://example.com/${smokeId}`,
        dedupeKey: `smoke:${smokeId}`,
        excerpt: "Smoke excerpt for source/reading shell validation.",
        ingestionStatus: IngestionStatus.READY,
        readState: ReadState.UNREAD,
        publishedAt: new Date("2025-03-18T00:00:00.000Z"),
        publishedAtKind: PublishedAtKind.EXACT,
        enteredReadingAt: null,
        content: {
          create: {
            plainText: "This is a smoke document used to validate source and reading behavior.",
            contentHtml: "<p>This is a smoke document used to validate source and reading behavior.</p>",
            rawHtml: "<article><p>This is a smoke document used to validate source and reading behavior.</p></article>",
            textHash: `hash-${smokeId}`,
            wordCount: 13,
            extractedAt: new Date(),
          },
        },
      },
      select: {
        id: true,
      },
    });

    const browser = await chromium.launch({
      executablePath: process.env.CHROME_PATH ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      headless: true,
    });

    try {
      const context = await browser.newContext({
        viewport: {
          width: 1440,
          height: 1280,
        },
      });

      await context.addCookies([
        {
          name: SESSION_COOKIE_NAME,
          value: sessionToken,
          domain: "127.0.0.1",
          path: "/",
          httpOnly: true,
          secure: false,
          sameSite: "Lax",
        },
      ]);

      const page = await context.newPage();

      await page.goto(`${baseUrl}/sources`, { waitUntil: "networkidle" });
      await page.waitForSelector("text=来源库");
      await page.waitForSelector("text=保存网页链接");
      await page.waitForSelector('input[type="search"]');
      await page.fill('input[type="search"]', "Smoke Source Document");
      const quickSearchPayload = await getJson<{ ok: true; data: { items: Array<{ id: string }> } }>(
        baseUrl,
        sessionToken,
        `/api/documents/quick-search?q=${encodeURIComponent("Smoke Source Document")}`,
      );
      assert.equal(quickSearchPayload.ok, true, "Expected global search quick-search response to succeed.");
      assert.equal(
        quickSearchPayload.data.items.some((item: { id: string }) => item.id === sourceDocument.id),
        true,
        "Expected quick-search results to include the smoke source document.",
      );

      await page.goto(`${baseUrl}/documents/${sourceDocument.id}`, { waitUntil: "networkidle" });

      await page.waitForURL(new RegExp(`/documents/${sourceDocument.id}$`));
      await page.waitForSelector(`text=Smoke Source Document ${smokeId}`);

      const openedDocument = await prisma.document.findUniqueOrThrow({
        where: {
          id: sourceDocument.id,
        },
        select: {
          enteredReadingAt: true,
        },
      });

      assert.notEqual(openedDocument.enteredReadingAt, null, "Expected opening the document to move it into Reading.");

      await page.goto(`${baseUrl}/reading`, { waitUntil: "networkidle" });
      await page.waitForSelector("text=Reading");
      await page.waitForSelector(`text=Smoke Source Document ${smokeId}`);
      await assertAbsent(page, "保存网页链接");
      await page.waitForSelector('input[type="search"]');

      await page.goto(`${baseUrl}/highlights`, { waitUntil: "networkidle" });
      await page.waitForSelector("text=把真正重要的句子留下来");
      await assertAbsent(page, "保存网页链接");
      await page.waitForSelector('input[type="search"]');

      await page.goto(`${baseUrl}/export`, { waitUntil: "networkidle" });
      await page.waitForSelector("text=把读完的信号交给下游系统");
      await assertAbsent(page, "保存网页链接");
      await page.waitForSelector('input[type="search"]');

      await page.screenshot({ path: screenshotPath, fullPage: true });

      console.log(
        JSON.stringify(
          {
            ok: true,
            documentId: sourceDocument.id,
            screenshotPath,
          },
          null,
          2,
        ),
      );

      await context.close();
    } finally {
      await browser.close();
    }
  } finally {
    await prisma.document.deleteMany({
      where: {
        title: {
          startsWith: "Smoke Source Document ",
        },
      },
    });
    await prisma.$disconnect();
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

  return {
    DATABASE_URL: resolveSmokeDatabaseUrl(merged),
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
  await new Promise<void>((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolvePromise());
  });

  const address = server.address();
  await new Promise<void>((resolvePromise, reject) => server.close((error) => (error ? reject(error) : resolvePromise())));

  if (!address || typeof address === "string") {
    throw new Error("Failed to allocate a local port.");
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

  return {
    child,
    logs,
  };
}

async function stopServer(server: { child: ChildProcess }) {
  if (server.child.exitCode !== null) {
    return;
  }

  server.child.kill("SIGTERM");
  await Promise.race([
    new Promise<void>((resolvePromise) => server.child.once("exit", () => resolvePromise())),
    sleep(5_000).then(() => {
      if (server.child.exitCode === null) {
        server.child.kill("SIGKILL");
      }
    }),
  ]);
}

function trimLogs(logs: string[]) {
  const combined = logs.join("");
  if (combined.length <= 12_000) {
    return;
  }

  logs.splice(0, logs.length, combined.slice(-12_000));
}

async function waitForServer(baseUrl: string, sessionToken: string) {
  const deadline = Date.now() + 30_000;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/sources`, {
        headers: {
          cookie: cookieHeader(sessionToken),
        },
        redirect: "manual",
      });

      if (response.status === 200) {
        return;
      }
    } catch {
      // ignore until next retry
    }

    await sleep(250);
  }

  throw new Error("Timed out waiting for the local smoke server to start.");
}

function cookieHeader(sessionToken: string) {
  return `${SESSION_COOKIE_NAME}=${sessionToken}`;
}

async function getJson<T>(baseUrl: string, sessionToken: string, path: string): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      cookie: cookieHeader(sessionToken),
    },
  });

  if (!response.ok) {
    throw new Error(`Request to ${path} failed with status ${response.status}.`);
  }

  return (await response.json()) as T;
}

async function assertAbsent(page: import("playwright").Page, text: string) {
  const matches = await page.getByText(text, { exact: false }).count();
  assert.equal(matches, 0, `Did not expect to find text "${text}" on this page.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
