import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { archiveLocalBuildArtifacts, formatArchivedBuildArtifacts } from "./archive-build-artifacts.mjs";

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

  if (await isGitWorktreeCwd(cwd)) {
    console.error(formatWorktreeGuardMessage(mode));
    process.exit(1);
  }

  const child =
    mode === "dev"
      ? spawn("npx", ["next", "dev", ...restArgs], {
          cwd,
          env: process.env,
          stdio: "inherit",
        })
      : await spawnBuild(cwd);

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });
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
