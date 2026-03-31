import assert from "node:assert/strict";
import test from "node:test";
import { DocumentType, ReadState } from "@prisma/client";
import { RouteError } from "@/server/api/response";
import { __documentQueryParsersForTests, parseDocumentListQuery } from "@/server/modules/documents/document.service";

test("parseDocumentListQuery returns stable defaults", () => {
  const parsed = parseDocumentListQuery(new URLSearchParams());

  assert.equal(parsed.surface, "source");
  assert.equal(parsed.sort, "latest");
  assert.equal(parsed.page, 1);
  assert.equal(parsed.pageSize, 20);
  assert.equal(parsed.type, undefined);
  assert.equal(parsed.readState, undefined);
  assert.equal(parsed.isFavorite, undefined);
});

test("parseDocumentListQuery normalizes sort aliases", () => {
  assert.equal(parseDocumentListQuery(new URLSearchParams("sort=newest")).sort, "latest");
  assert.equal(parseDocumentListQuery(new URLSearchParams("sort=published")).sort, "latest");
  assert.equal(parseDocumentListQuery(new URLSearchParams("sort=oldest")).sort, "earliest");
});

test("parseDocumentListQuery parses surface, type, and readState", () => {
  const parsed = parseDocumentListQuery(
    new URLSearchParams("surface=reading&type=WEB_PAGE&readState=UNREAD"),
  );

  assert.equal(parsed.surface, "reading");
  assert.equal(parsed.type, DocumentType.WEB_PAGE);
  assert.equal(parsed.readState, ReadState.UNREAD);
});

test("parseDocumentListQuery caps pageSize at max", () => {
  const parsed = parseDocumentListQuery(new URLSearchParams("pageSize=999&page=2"));
  assert.equal(parsed.page, 2);
  assert.equal(parsed.pageSize, 50);
});

test("parseDocumentListQuery rejects invalid sort", () => {
  assert.throws(
    () => parseDocumentListQuery(new URLSearchParams("sort=random")),
    (error) => error instanceof RouteError && error.code === "INVALID_QUERY",
  );
});

test("parseDocumentListQuery rejects invalid document type", () => {
  assert.throws(
    () => parseDocumentListQuery(new URLSearchParams("type=BOOKMARK")),
    (error) => error instanceof RouteError && error.code === "INVALID_QUERY",
  );
});

test("parseDocumentListQuery rejects invalid boolean query", () => {
  assert.throws(
    () => parseDocumentListQuery(new URLSearchParams("isFavorite=yes")),
    (error) => error instanceof RouteError && error.code === "INVALID_QUERY",
  );
});

test("document query parser helpers remain exported for test coverage", () => {
  assert.equal(typeof __documentQueryParsersForTests.parseDocumentSort, "function");
  assert.equal(typeof __documentQueryParsersForTests.parseDocumentSurface, "function");
  assert.equal(typeof __documentQueryParsersForTests.parseDocumentType, "function");
  assert.equal(typeof __documentQueryParsersForTests.parseReadState, "function");
  assert.equal(typeof __documentQueryParsersForTests.parsePositiveInt, "function");
  assert.equal(typeof __documentQueryParsersForTests.parseOptionalBoolean, "function");
});
