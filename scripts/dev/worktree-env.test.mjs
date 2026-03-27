import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadWorktreeEnv, parseEnvContent } from "./worktree-env.mjs";

test("parseEnvContent handles quoted values and comments", () => {
  const parsed = parseEnvContent(`
# comment
DATABASE_URL="postgresql://localhost:5432/reader_app?schema=public"
AUTH_SECRET='secret-value'
EMPTY=
PLAIN=value
`);

  assert.equal(parsed.DATABASE_URL, "postgresql://localhost:5432/reader_app?schema=public");
  assert.equal(parsed.AUTH_SECRET, "secret-value");
  assert.equal(parsed.EMPTY, "");
  assert.equal(parsed.PLAIN, "value");
});

test("loadWorktreeEnv reads .env and overrides it with .env.worktree.local", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "reader-worktree-env-"));

  try {
    await fs.writeFile(
      path.join(cwd, ".env"),
      'DATABASE_URL="postgresql://localhost:5432/base"\nAUTH_SECRET="base-secret"\n',
      "utf8",
    );
    await fs.writeFile(
      path.join(cwd, ".env.local"),
      'DATABASE_URL="postgresql://neon/root-override"\n',
      "utf8",
    );
    await fs.writeFile(
      path.join(cwd, ".env.worktree.local"),
      'DATABASE_URL="postgresql://localhost:5432/worktree"\nINTERNAL_API_SECRET="local-secret"\n',
      "utf8",
    );

    const env = await loadWorktreeEnv({
      cwd,
      baseEnv: {
        PATH: process.env.PATH ?? "",
      },
    });

    assert.equal(env.DATABASE_URL, "postgresql://localhost:5432/worktree");
    assert.equal(env.AUTH_SECRET, "base-secret");
    assert.equal(env.INTERNAL_API_SECRET, "local-secret");
  } finally {
    await fs.rm(cwd, { recursive: true, force: true });
  }
});

test("loadWorktreeEnv lets explicit process env override files", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "reader-worktree-env-"));

  try {
    await fs.writeFile(path.join(cwd, ".env"), 'DATABASE_URL="postgresql://localhost:5432/base"\n', "utf8");

    const env = await loadWorktreeEnv({
      cwd,
      baseEnv: {
        PATH: process.env.PATH ?? "",
        DATABASE_URL: "postgresql://localhost:5432/from-shell",
      },
    });

    assert.equal(env.DATABASE_URL, "postgresql://localhost:5432/from-shell");
  } finally {
    await fs.rm(cwd, { recursive: true, force: true });
  }
});

test("loadWorktreeEnv injects a local AUTH_SECRET when none is configured", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "reader-worktree-env-"));

  try {
    await fs.writeFile(path.join(cwd, ".env"), 'DATABASE_URL="postgresql://localhost:5432/base"\n', "utf8");

    const env = await loadWorktreeEnv({
      cwd,
      baseEnv: {
        PATH: process.env.PATH ?? "",
      },
    });

    assert.equal(env.AUTH_SECRET, "reader-worktree-local-secret");
  } finally {
    await fs.rm(cwd, { recursive: true, force: true });
  }
});
