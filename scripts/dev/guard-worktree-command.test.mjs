import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  formatWorktreeGuardMessage,
  isGitWorktreeCwd,
} from "./guard-worktree-command.mjs";

test("isGitWorktreeCwd returns true when .git is a file", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "reader-guard-"));

  try {
    await fs.writeFile(path.join(cwd, ".git"), "gitdir: /tmp/fake-worktree\n", "utf8");

    await assert.doesNotReject(() => isGitWorktreeCwd(cwd));
    assert.equal(await isGitWorktreeCwd(cwd), true);
  } finally {
    await fs.rm(cwd, { recursive: true, force: true });
  }
});

test("isGitWorktreeCwd returns false when .git is a directory", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "reader-guard-"));

  try {
    await fs.mkdir(path.join(cwd, ".git"));
    assert.equal(await isGitWorktreeCwd(cwd), false);
  } finally {
    await fs.rm(cwd, { recursive: true, force: true });
  }
});

test("formatWorktreeGuardMessage points dev users at dev:local", () => {
  const message = formatWorktreeGuardMessage("dev");

  assert.match(message, /worktree/i);
  assert.match(message, /npm run dev:local/);
  assert.doesNotMatch(message, /build:local/);
});

test("formatWorktreeGuardMessage points build users at build:local", () => {
  const message = formatWorktreeGuardMessage("build");

  assert.match(message, /worktree/i);
  assert.match(message, /npm run build:local/);
  assert.doesNotMatch(message, /dev:local/);
});
