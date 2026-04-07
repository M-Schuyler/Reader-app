import { spawn } from "node:child_process";
import path from "node:path";
import { archiveLocalBuildArtifacts, formatArchivedBuildArtifacts } from "./archive-build-artifacts.mjs";
import { acquireDevServerLock, findActiveDevServerLock } from "./dev-server-lock.mjs";
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
let releaseDevServerLock = null;
let shutdownSignal = null;

if (mode === "build") {
  const activeDevServer = await findActiveDevServerLock({ cwd });

  if (activeDevServer.active) {
    console.error(activeDevServer.message);
    process.exit(1);
  }

  const archivedArtifacts = await archiveLocalBuildArtifacts({ cwd });
  const archivedMessage = formatArchivedBuildArtifacts(archivedArtifacts);

  if (archivedMessage) {
    console.warn(archivedMessage);
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

const child = spawn(
  mode === "dev" ? process.execPath : "sh",
  mode === "dev" ? [path.join(cwd, "node_modules", "next", "dist", "bin", "next"), "dev", ...restArgs] : ["-lc", "npx prisma generate && npx next build"],
  {
  cwd,
  env,
  stdio: "inherit",
},
);

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
