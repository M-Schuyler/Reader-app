import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

function readWorkspaceFile(filePath: string) {
  return readFileSync(new URL(`../../${filePath}`, import.meta.url), "utf8");
}

test("package scripts expose a single local verification baseline", () => {
  const packageJson = readWorkspaceFile("package.json");

  assert.match(packageJson, /"test":\s*"node scripts\/test\/run-all-tests\.mjs"/);
  assert.match(packageJson, /"typecheck":\s*"tsc --noEmit"/);
  assert.match(packageJson, /"verify:local":\s*"npm test && npm run typecheck && npm run build:local"/);
  assert.match(packageJson, /"build":\s*"node scripts\/dev\/guard-worktree-command\.mjs build"/);
  assert.match(packageJson, /"build:local":\s*"node scripts\/dev\/run-worktree-command\.mjs build"/);
  assert.doesNotMatch(packageJson, /"lint":/);
});

test("repo docs define the test boundary and qa/dev tooling boundary explicitly", () => {
  const readme = readWorkspaceFile("README.md");
  const qaReadme = readWorkspaceFile("src/app/qa/README.md");

  assert.match(readme, /## Engineering Workflow/);
  assert.match(readme, /npm test/);
  assert.match(readme, /npm run typecheck/);
  assert.match(readme, /npm run verify:local/);
  assert.match(readme, /scripts\/\*\*\/\*\.test\.mjs/);
  assert.match(readme, /src\/\*\*\/\*\.test\.ts/);
  assert.match(readme, /tests\/\*\*\/\*\.test\.ts/);

  assert.match(qaReadme, /QA/);
  assert.match(qaReadme, /not production surfaces/i);
  assert.match(qaReadme, /fixture|playground/i);
  assert.match(qaReadme, /NODE_ENV === "production"/);
});

test("debug scripts and finder noise are kept out of the repo root", () => {
  const gitignore = readWorkspaceFile(".gitignore");
  const mainAppStore = new URL("../../src/app/(main)/.DS_Store", import.meta.url);
  const componentsStore = new URL("../../src/components/.DS_Store", import.meta.url);
  const libStore = new URL("../../src/lib/.DS_Store", import.meta.url);
  const docsStore = new URL("../../docs/superpowers/.DS_Store", import.meta.url);
  const rootDebugScript = new URL("../../test-browser.js", import.meta.url);
  const movedDebugScript = new URL("../../scripts/debug/test-browser.js", import.meta.url);

  assert.match(gitignore, /^\.DS_Store$/m);
  assert.equal(existsSync(rootDebugScript), false);
  assert.equal(existsSync(movedDebugScript), true);
  assert.equal(existsSync(mainAppStore), false);
  assert.equal(existsSync(componentsStore), false);
  assert.equal(existsSync(libStore), false);
  assert.equal(existsSync(docsStore), false);
});
