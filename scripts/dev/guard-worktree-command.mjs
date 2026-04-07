import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { archiveLocalBuildArtifacts, formatArchivedBuildArtifacts } from "./archive-build-artifacts.mjs";
import { acquireDevServerLock, findActiveDevServerLock } from "./dev-server-lock.mjs";

const [mode, ...restArgs] = process.argv.slice(2);

if (import.meta.url === `file://${process.argv[1]}`) {
  await main();
}

export async function isGitWorktreeCwd(cwd) {
  try {
    const gitPath = path.join(cwd, ".git");
    const stat = await fs.lstat(gitPath);
    return stat.isFile();
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

export function formatWorktreeGuardMessage(command) {
  const safeCommand = command === "build" ? "npm run build:local" : "npm run dev:local";

  return [
    "",
    "Blocked: bare dev/build commands are disabled inside git worktrees.",
    "",
    `Do not run \`npm run ${command}\` in this worktree.`,
    `Use \`${safeCommand}\` instead.`,
    "",
  ].join("\n");
}

async function main() {
  if (!mode || !["dev", "build"].includes(mode)) {
    console.error("Usage: node scripts/dev/guard-worktree-command.mjs <dev|build> [args...]");
    process.exit(1);
  }

  const cwd = process.cwd();
  let releaseDevServerLock = null;
  let shutdownSignal = null;

  if (await isGitWorktreeCwd(cwd)) {
    console.error(formatWorktreeGuardMessage(mode));
    process.exit(1);
  }

  if (mode === "build") {
    const activeDevServer = await findActiveDevServerLock({ cwd });

    if (activeDevServer.active) {
      console.error(activeDevServer.message);
      process.exit(1);
    }
  }

  if (mode === "dev") {
    const lockResult = await acquireDevServerLock({ cwd });

    if (!lockResult.acquired) {
      console.error(lockResult.message);
      process.exit(1);
    }

    releaseDevServerLock = lockResult.release;
  }

  const child =
    mode === "dev"
      ? spawn(process.execPath, [path.join(cwd, "node_modules", "next", "dist", "bin", "next"), "dev", ...restArgs], {
          cwd,
          env: process.env,
          stdio: "inherit",
        })
      : await spawnBuild(cwd);

  child.on("exit", (code, signal) => {
    void releaseDevServerLock?.();

    if (signal) {
      if (shutdownSignal) {
        process.exit(0);
        return;
      }

      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });

  for (const event of ["SIGINT", "SIGTERM"]) {
    process.on(event, () => {
      if (shutdownSignal) {
        return;
      }

      shutdownSignal = event;

      void releaseDevServerLock?.().finally(() => {
        child.kill(event);
      });
    });
  }
}

async function spawnBuild(cwd) {
  const archivedArtifacts = await archiveLocalBuildArtifacts({ cwd });
  const archivedMessage = formatArchivedBuildArtifacts(archivedArtifacts);

  if (archivedMessage) {
    console.warn(archivedMessage);
  }

  return spawn("sh", ["-lc", "npx prisma generate && npx next build"], {
    cwd,
    env: process.env,
    stdio: "inherit",
  });
}
