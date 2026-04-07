import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export const DEV_SERVER_LOCK_FILENAME = ".reader-dev-server.lock";

export function getDevServerLockPath(cwd) {
  return path.join(cwd, DEV_SERVER_LOCK_FILENAME);
}

export async function findActiveDevServerLock({
  cwd,
  isProcessRunning = defaultIsProcessRunning,
  readProcessCommand = defaultReadProcessCommand,
} = {}) {
  if (!cwd) {
    throw new Error("findActiveDevServerLock requires cwd");
  }

  const lockPath = getDevServerLockPath(cwd);
  const activeLock = await resolveActiveDevServerLock({
    cwd,
    lockPath,
    isProcessRunning,
    readProcessCommand,
  });

  if (!activeLock) {
    return {
      active: false,
      lockPath,
    };
  }

  return {
    active: true,
    lockPath,
    pid: activeLock.pid,
    startedAt: activeLock.startedAt,
    message: formatDevServerLockMessage({
      lockPath,
      pid: activeLock.pid,
      startedAt: activeLock.startedAt,
    }),
  };
}

export async function acquireDevServerLock({
  cwd,
  pid = process.pid,
  command = process.argv.join(" "),
  isProcessRunning = defaultIsProcessRunning,
  readProcessCommand = defaultReadProcessCommand,
} = {}) {
  if (!cwd) {
    throw new Error("acquireDevServerLock requires cwd");
  }

  const lockPath = getDevServerLockPath(cwd);
  const token = `${pid}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const payload = {
    command,
    createdAt: new Date().toISOString(),
    cwd,
    pid,
    token,
  };

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      await fs.writeFile(lockPath, `${JSON.stringify(payload, null, 2)}\n`, { flag: "wx" });

      return {
        acquired: true,
        lockPath,
        release: createDevServerLockReleaser({ lockPath, token }),
      };
    } catch (error) {
      if (!isErrorCode(error, "EEXIST")) {
        throw error;
      }
    }

    const activeLock = await resolveActiveDevServerLock({
      cwd,
      lockPath,
      isProcessRunning,
      readProcessCommand,
    });

    if (!activeLock) {
      continue;
    }

    return {
      acquired: false,
      lockPath,
      message: formatDevServerLockMessage({
        lockPath,
        pid: activeLock.pid,
        startedAt: activeLock.startedAt,
      }),
    };
  }

  return {
    acquired: false,
    lockPath,
    message: formatDevServerLockMessage({ lockPath, pid: null, startedAt: null }),
  };
}

export function formatDevServerLockMessage({ lockPath, pid, startedAt }) {
  const startedAtLabel = startedAt
    ? new Date(startedAt).toLocaleString("zh-CN", {
        hour12: false,
      })
    : "unknown";

  return [
    "",
    "Blocked: another Reader dev server is already running.",
    "",
    `PID: ${pid ?? "unknown"}`,
    `Started at: ${startedAtLabel}`,
    `Lock file: ${lockPath}`,
    "",
    "Stop the existing dev server, then retry.",
    `If this lock is stale, run: rm -f "${lockPath}"`,
    "",
  ].join("\n");
}

async function resolveActiveDevServerLock({
  cwd,
  lockPath,
  isProcessRunning,
  readProcessCommand,
}) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const existingLock = await readLockPayload(lockPath);

    if (!existingLock) {
      return null;
    }

    if (!isValidPid(existingLock.pid)) {
      await removeLockIfPresent(lockPath);
      continue;
    }

    const running = await isProcessRunning(existingLock.pid);

    if (!running) {
      await removeLockIfPresent(lockPath);
      continue;
    }

    const processCommand = await readProcessCommand(existingLock.pid);

    if (!looksLikeReaderDevProcess(processCommand, cwd)) {
      await removeLockIfPresent(lockPath);
      continue;
    }

    return {
      pid: existingLock.pid,
      startedAt: existingLock.createdAt ?? null,
    };
  }

  return null;
}

export async function defaultIsProcessRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (isErrorCode(error, "ESRCH")) {
      return false;
    }

    if (isErrorCode(error, "EPERM")) {
      return true;
    }

    throw error;
  }
}

export async function defaultReadProcessCommand(pid) {
  try {
    const { stdout } = await execFileAsync("ps", ["-p", String(pid), "-o", "command="]);
    const command = stdout.trim();
    return command.length > 0 ? command : null;
  } catch (error) {
    return null;
  }
}

function createDevServerLockReleaser({ lockPath, token }) {
  let released = false;

  return async function releaseDevServerLock() {
    if (released) {
      return;
    }

    released = true;

    const payload = await readLockPayload(lockPath);

    if (payload?.token && payload.token !== token) {
      return;
    }

    await removeLockIfPresent(lockPath);
  };
}

function looksLikeReaderDevProcess(commandLine, cwd) {
  if (!commandLine) {
    return false;
  }

  const normalizedCommand = commandLine.replace(/\\/g, "/");
  const normalizedCwd = cwd.replace(/\\/g, "/");
  const startedFromWorktreeScript =
    /guard-worktree-command\.mjs\s+dev/.test(normalizedCommand) ||
    /run-worktree-command\.mjs\s+dev/.test(normalizedCommand);

  if (startedFromWorktreeScript) {
    return true;
  }

  if (!normalizedCommand.includes(normalizedCwd)) {
    return false;
  }

  return /\bnext dev\b/.test(normalizedCommand) || /next\/dist\/bin\/next\s+dev/.test(normalizedCommand);
}

function isValidPid(value) {
  return Number.isInteger(value) && value > 0;
}

async function readLockPayload(lockPath) {
  try {
    const raw = await fs.readFile(lockPath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (isErrorCode(error, "ENOENT")) {
      return null;
    }

    if (error instanceof SyntaxError) {
      return null;
    }

    throw error;
  }
}

async function removeLockIfPresent(lockPath) {
  try {
    await fs.unlink(lockPath);
  } catch (error) {
    if (isErrorCode(error, "ENOENT")) {
      return;
    }

    throw error;
  }
}

function isErrorCode(error, code) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === code);
}
