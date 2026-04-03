import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
// @ts-expect-error The script is authored as .mjs and exercised directly by the test harness.
import {
  acquireDevServerLock,
  DEV_SERVER_LOCK_FILENAME,
  formatDevServerLockMessage,
} from "../../scripts/dev/dev-server-lock.mjs";

test("acquireDevServerLock creates lock and releases it", async () => {
  const sandboxRoot = await fs.mkdtemp(path.join(os.tmpdir(), "reader-dev-lock-"));
  const workspaceDir = path.join(sandboxRoot, "reader-app");
  await fs.mkdir(workspaceDir, { recursive: true });

  const lockResult = await acquireDevServerLock({
    command: "node scripts/dev/run-worktree-command.mjs dev",
    cwd: workspaceDir,
    isProcessRunning: async () => false,
    pid: 45678,
    readProcessCommand: async () => null,
  });

  assert.equal(lockResult.acquired, true);
  assert.equal(await pathExists(path.join(workspaceDir, DEV_SERVER_LOCK_FILENAME)), true);

  await lockResult.release();
  assert.equal(await pathExists(path.join(workspaceDir, DEV_SERVER_LOCK_FILENAME)), false);
});

test("acquireDevServerLock blocks when active reader dev process exists", async () => {
  const sandboxRoot = await fs.mkdtemp(path.join(os.tmpdir(), "reader-dev-lock-"));
  const workspaceDir = path.join(sandboxRoot, "reader-app");
  await fs.mkdir(workspaceDir, { recursive: true });

  await fs.writeFile(
    path.join(workspaceDir, DEV_SERVER_LOCK_FILENAME),
    JSON.stringify({
      command: "node scripts/dev/run-worktree-command.mjs dev",
      createdAt: "2026-04-03T00:00:00.000Z",
      cwd: workspaceDir,
      pid: 12345,
      token: "existing-token",
    }),
  );

  const lockResult = await acquireDevServerLock({
    cwd: workspaceDir,
    isProcessRunning: async () => true,
    readProcessCommand: async () => `${workspaceDir}/node_modules/.bin/next dev --hostname 127.0.0.1 --port 3000`,
  });

  assert.equal(lockResult.acquired, false);
  assert.match(lockResult.message ?? "", /another Reader dev server is already running/);
  assert.match(lockResult.message ?? "", /PID: 12345/);
});

test("acquireDevServerLock blocks when existing command is the worktree dev launcher", async () => {
  const sandboxRoot = await fs.mkdtemp(path.join(os.tmpdir(), "reader-dev-lock-"));
  const workspaceDir = path.join(sandboxRoot, "reader-app");
  await fs.mkdir(workspaceDir, { recursive: true });

  await fs.writeFile(
    path.join(workspaceDir, DEV_SERVER_LOCK_FILENAME),
    JSON.stringify({
      command: "/usr/local/bin/node scripts/dev/run-worktree-command.mjs dev --hostname 127.0.0.1 --port 3000",
      createdAt: "2026-04-03T00:00:00.000Z",
      cwd: workspaceDir,
      pid: 14600,
      token: "launcher-token",
    }),
  );

  const lockResult = await acquireDevServerLock({
    cwd: workspaceDir,
    isProcessRunning: async () => true,
    readProcessCommand: async () => "/usr/local/bin/node scripts/dev/run-worktree-command.mjs dev --hostname 127.0.0.1 --port 3000",
  });

  assert.equal(lockResult.acquired, false);
  assert.match(lockResult.message ?? "", /PID: 14600/);
});

test("acquireDevServerLock releases stale lock from transient wrapper pid", async () => {
  const sandboxRoot = await fs.mkdtemp(path.join(os.tmpdir(), "reader-dev-lock-"));
  const workspaceDir = path.join(sandboxRoot, "reader-app");
  await fs.mkdir(workspaceDir, { recursive: true });

  await fs.writeFile(
    path.join(workspaceDir, DEV_SERVER_LOCK_FILENAME),
    JSON.stringify({
      command: "/usr/local/bin/node scripts/dev/run-worktree-command.mjs dev --hostname 127.0.0.1 --port 3000",
      createdAt: "2026-04-03T00:00:00.000Z",
      cwd: workspaceDir,
      pid: 45601,
      token: "wrapper-token",
    }),
  );

  const lockResult = await acquireDevServerLock({
    command: "node node_modules/next/dist/bin/next dev --hostname 127.0.0.1 --port 3001",
    cwd: workspaceDir,
    isProcessRunning: async () => true,
    pid: 45602,
    readProcessCommand: async () => "npm",
  });

  assert.equal(lockResult.acquired, true);
  await lockResult.release();
});

test("acquireDevServerLock cleans stale lock when process is gone", async () => {
  const sandboxRoot = await fs.mkdtemp(path.join(os.tmpdir(), "reader-dev-lock-"));
  const workspaceDir = path.join(sandboxRoot, "reader-app");
  await fs.mkdir(workspaceDir, { recursive: true });

  await fs.writeFile(
    path.join(workspaceDir, DEV_SERVER_LOCK_FILENAME),
    JSON.stringify({
      command: "node scripts/dev/run-worktree-command.mjs dev",
      createdAt: "2026-04-03T00:00:00.000Z",
      cwd: workspaceDir,
      pid: 23456,
      token: "stale-token",
    }),
  );

  const lockResult = await acquireDevServerLock({
    command: "node scripts/dev/run-worktree-command.mjs dev",
    cwd: workspaceDir,
    isProcessRunning: async () => false,
    pid: 34567,
    readProcessCommand: async () => null,
  });

  assert.equal(lockResult.acquired, true);
  await lockResult.release();
});

test("formatDevServerLockMessage provides clear recovery hint", () => {
  const message = formatDevServerLockMessage({
    lockPath: "/tmp/reader/.reader-dev-server.lock",
    pid: 67890,
    startedAt: "2026-04-03T00:00:00.000Z",
  });

  assert.match(message, /Stop the existing dev server, then retry/);
  assert.match(message, /rm -f "\/tmp\/reader\/.reader-dev-server.lock"/);
});

async function pathExists(targetPath: string) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}
