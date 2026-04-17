import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
// @ts-expect-error The script is authored as .mjs and exercised directly by the test harness.
import { discoverWorkspaceTestFiles } from "../../scripts/test/run-all-tests.mjs";

test("discoverWorkspaceTestFiles returns all tests from both src and tests roots", async () => {
  const sandboxRoot = await fs.mkdtemp(path.join(os.tmpdir(), "reader-test-discovery-"));
  const workspaceDir = path.join(sandboxRoot, "reader-app");

  await fs.mkdir(path.join(workspaceDir, "src/lib"), { recursive: true });
  await fs.mkdir(path.join(workspaceDir, "tests/ui"), { recursive: true });
  await fs.mkdir(path.join(workspaceDir, "scripts/dev"), { recursive: true });
  await fs.mkdir(path.join(workspaceDir, "node_modules/fake-package"), { recursive: true });

  await fs.writeFile(path.join(workspaceDir, "src/lib/source-library.test.ts"), "export {};\n");
  await fs.writeFile(path.join(workspaceDir, "src/lib/document-reader.test.tsx"), "export {};\n");
  await fs.writeFile(path.join(workspaceDir, "tests/ui/highlights-page.test.ts"), "export {};\n");
  await fs.writeFile(path.join(workspaceDir, "scripts/dev/worktree-env.test.mjs"), "export {};\n");
  await fs.writeFile(path.join(workspaceDir, "src/lib/not-a-test.ts"), "export {};\n");
  await fs.writeFile(path.join(workspaceDir, "node_modules/fake-package/ignored.test.ts"), "export {};\n");

  const discovered = await discoverWorkspaceTestFiles({ cwd: workspaceDir });

  assert.deepEqual(discovered, [
    path.join(workspaceDir, "scripts/dev/worktree-env.test.mjs"),
    path.join(workspaceDir, "src/lib/document-reader.test.tsx"),
    path.join(workspaceDir, "src/lib/source-library.test.ts"),
    path.join(workspaceDir, "tests/ui/highlights-page.test.ts"),
  ]);
});
