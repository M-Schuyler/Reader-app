import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { archiveLocalBuildArtifacts } from "../../scripts/dev/archive-build-artifacts.mjs";

test("archiveLocalBuildArtifacts moves stale Next artifacts out of the workspace root", async () => {
  const sandboxRoot = await fs.mkdtemp(path.join(os.tmpdir(), "reader-build-artifacts-"));
  const workspaceDir = path.join(sandboxRoot, "reader-app");
  const siblingDir = path.join(sandboxRoot, "shared-output");

  await fs.mkdir(workspaceDir, { recursive: true });
  await fs.mkdir(siblingDir, { recursive: true });
  await fs.mkdir(path.join(workspaceDir, ".next"));
  await fs.mkdir(path.join(workspaceDir, ".next-stale-123"));
  await fs.mkdir(path.join(workspaceDir, "src"));

  const archived = await archiveLocalBuildArtifacts({ cwd: workspaceDir });

  assert.equal(archived.length, 2);
  assert.equal(await pathExists(path.join(workspaceDir, ".next")), false);
  assert.equal(await pathExists(path.join(workspaceDir, ".next-stale-123")), false);
  assert.equal(await pathExists(path.join(workspaceDir, "src")), true);

  for (const entry of archived) {
    assert.equal(entry.archivedPath.startsWith(path.join(sandboxRoot, ".reader-build-trash", "reader-app")), true);
    assert.equal(await pathExists(entry.archivedPath), true);
  }
});

async function pathExists(targetPath: string) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}
