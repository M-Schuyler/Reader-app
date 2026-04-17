import fs from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadWorktreeEnv } from "../dev/worktree-env.mjs";

const TEST_FILE_PATTERN = /\.test\.(?:[cm]?js|tsx?)$/;
const DEFAULT_TEST_ROOTS = ["scripts", "src", "tests"];
const IGNORED_DIRECTORIES = new Set(["node_modules", ".next", "coverage", "dist"]);

export async function discoverWorkspaceTestFiles({ cwd = process.cwd(), roots = DEFAULT_TEST_ROOTS } = {}) {
  const discovered = [];

  for (const root of roots) {
    await collectTestFiles(path.join(cwd, root), discovered);
  }

  return discovered.sort();
}

async function collectTestFiles(currentPath, discovered) {
  let entries;

  try {
    entries = await fs.readdir(currentPath, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return;
    }

    throw error;
  }

  for (const entry of entries) {
    if (IGNORED_DIRECTORIES.has(entry.name)) {
      continue;
    }

    const nextPath = path.join(currentPath, entry.name);

    if (entry.isDirectory()) {
      await collectTestFiles(nextPath, discovered);
      continue;
    }

    if (TEST_FILE_PATTERN.test(entry.name)) {
      discovered.push(nextPath);
    }
  }
}

function runTests(targets, options = {}) {
  const result = spawnSync(process.execPath, ["--import", "tsx", "--test", ...targets], {
    cwd: options.cwd,
    env: options.env,
    stdio: "inherit",
  });

  if (result.error) {
    throw result.error;
  }

  process.exit(result.status ?? 1);
}

async function main() {
  const cwd = process.cwd();
  const cliTargets = process.argv.slice(2);
  const targets = cliTargets.length > 0 ? cliTargets : await discoverWorkspaceTestFiles({ cwd });

  if (targets.length === 0) {
    console.error("No test files were found under scripts/, src/, or tests/.");
    process.exit(1);
  }

  const env = await loadWorktreeEnv({
    cwd,
    baseEnv: process.env,
  });

  runTests(targets, { cwd, env });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
