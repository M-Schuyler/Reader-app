import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { IngestionStatus } from "@prisma/client";
import { importDocumentFromArchive } from "@/server/modules/documents/document.service";
import type { GetDocumentResponseData } from "@/server/modules/documents/document.types";

function readWorkspaceFile(path: string) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

test("importDocumentFromArchive hydrates first and returns the normal mapped document detail", async () => {
  const calls: string[] = [];
  const mappedDetail = {
    document: {
      id: "catalog_doc",
      ingestionStatus: IngestionStatus.READY,
      content: {
        plainText: "归档正文",
      },
    },
  } as GetDocumentResponseData;

  const result = await importDocumentFromArchive("catalog_doc", {
    hydrateWechatArchiveDocument: async (id) => {
      calls.push(`hydrate:${id}`);
      return {} as never;
    },
    getDocument: async (id) => {
      calls.push(`get:${id}`);
      return mappedDetail;
    },
  });

  assert.deepEqual(calls, ["hydrate:catalog_doc", "get:catalog_doc"]);
  assert.equal(result, mappedDetail);
});

test("archive import route is authenticated and delegates to the document service", () => {
  const route = readWorkspaceFile("src/app/api/documents/[id]/import-from-archive/route.ts");

  assert.match(route, /export async function POST/);
  assert.match(route, /requireApiUser/);
  assert.match(route, /importDocumentFromArchive/);
  assert.match(route, /DOCUMENT_NOT_FOUND/);
  assert.match(route, /handleRouteError/);
});
