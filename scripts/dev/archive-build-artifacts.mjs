import fs from "node:fs/promises";
import path from "node:path";

const BUILD_OUTPUT_DIRECTORY = ".next";
const STALE_BUILD_PREFIX = ".next-stale-";
const BUILD_TRASH_DIRECTORY = ".reader-build-trash";

export async function archiveLocalBuildArtifacts({ cwd }) {
  const entries = await fs.readdir(cwd, { withFileTypes: true });
  const buildArtifacts = entries
    .filter((entry) => entry.isDirectory() && shouldArchiveBuildArtifact(entry.name))
    .map((entry) => entry.name)
    .sort();

  if (buildArtifacts.length === 0) {
    return [];
  }

  const trashRoot = path.join(cwd, BUILD_TRASH_DIRECTORY);
  await fs.mkdir(trashRoot, { recursive: true });

  const stamp = Date.now();
  const archivedArtifacts = [];

  for (const name of buildArtifacts) {
    const archivedPath = await createArchivePath({ trashRoot, name, stamp });
    await fs.rename(path.join(cwd, name), archivedPath);
    archivedArtifacts.push({ name, archivedPath });
  }

  return archivedArtifacts;
}

export function formatArchivedBuildArtifacts(archivedArtifacts) {
  if (archivedArtifacts.length === 0) {
    return "";
  }

  const names = archivedArtifacts.map((artifact) => artifact.name).join(", ");
  return `Archived previous build artifacts: ${names}`;
}

function shouldArchiveBuildArtifact(name) {
  return name === BUILD_OUTPUT_DIRECTORY || name.startsWith(STALE_BUILD_PREFIX);
}

async function createArchivePath({ trashRoot, name, stamp }) {
  let suffix = 0;

  while (true) {
    const candidate = path.join(trashRoot, `${name}-${stamp}${suffix === 0 ? "" : `-${suffix}`}`);

    try {
      await fs.access(candidate);
      suffix += 1;
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
        return candidate;
      }

      throw error;
    }
  }
}
