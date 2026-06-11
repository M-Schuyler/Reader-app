import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { importWechatArchiveCatalog } from "@/server/modules/imports/wechat-archive";
import { prisma } from "@/server/db/client";

const DEFAULT_ARCHIVE_ROOT = path.join(os.homedir(), "projects/信息源/公众号");

async function main() {
  const rootPath = path.resolve(process.argv[2] ?? DEFAULT_ARCHIVE_ROOT);
  const sinceYear = process.env.IMPORT_SINCE_YEAR ? Number(process.env.IMPORT_SINCE_YEAR) : null;
  const minPublishedAt = sinceYear ? new Date(`${sinceYear}-01-01T00:00:00+08:00`) : null;
  const result = await importWechatArchiveCatalog({ rootPath, minPublishedAt });

  console.log(JSON.stringify({ rootPath, sinceYear, ...result }, null, 2));
  if (result.failed > 0) {
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main()
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
