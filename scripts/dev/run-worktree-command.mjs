import { spawn } from "node:child_process";
import path from "node:path";
import { archiveLocalBuildArtifacts, formatArchivedBuildArtifacts } from "./archive-build-artifacts.mjs";
import { loadWorktreeEnv } from "./worktree-env.mjs";

const [mode, ...restArgs] = process.argv.slice(2);

if (!mode || !["dev", "build"].includes(mode)) {
  console.error('Usage: node scripts/dev/run-worktree-command.mjs <dev|build> [args...]');
  process.exit(1);
}

const cwd = process.cwd();
const env = await loadWorktreeEnv({
  cwd,
  baseEnv: process.env,
});

if (mode === "build") {
  const archivedArtifacts = await archiveLocalBuildArtifacts({ cwd });
  const archivedMessage = formatArchivedBuildArtifacts(archivedArtifacts);

  if (archivedMessage) {
    console.warn(archivedMessage);
  }
}

const args = mode === "dev" ? ["next", "dev", ...restArgs] : ["sh", "-lc", "npx prisma generate && npx next build"];

const child = spawn(mode === "dev" ? "npx" : args[0], mode === "dev" ? args : args.slice(1), {
  cwd,
  env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
