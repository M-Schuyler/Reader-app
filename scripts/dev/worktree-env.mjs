import fs from "node:fs/promises";
import path from "node:path";

export async function loadWorktreeEnv({ cwd, baseEnv = process.env }) {
  const fileEnv = {
    ...(await readEnvFile(path.join(cwd, ".env"))),
    ...(await readEnvFile(path.join(cwd, ".env.worktree.local"))),
  };

  const env = {
    ...fileEnv,
    ...baseEnv,
  };

  if (!env.AUTH_SECRET) {
    env.AUTH_SECRET = "reader-worktree-local-secret";
  }

  return env;
}

export function parseEnvContent(content) {
  return content
    .split(/\r?\n/)
    .reduce((env, rawLine) => {
      const line = rawLine.trim();

      if (!line || line.startsWith("#")) {
        return env;
      }

      const separatorIndex = line.indexOf("=");

      if (separatorIndex === -1) {
        return env;
      }

      const key = line.slice(0, separatorIndex).trim();
      const value = normalizeEnvValue(line.slice(separatorIndex + 1).trim());

      if (!key) {
        return env;
      }

      return {
        ...env,
        [key]: value,
      };
    }, {});
}

async function readEnvFile(filePath) {
  try {
    return parseEnvContent(await fs.readFile(filePath, "utf8"));
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return {};
    }

    throw error;
  }
}

function normalizeEnvValue(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}
