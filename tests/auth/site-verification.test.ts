import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";

test("Google ownership verification is public while reader and API routes remain protected", () => {
  const source = ts.createSourceFile("middleware.ts", readFileSync("src/middleware.ts", "utf8"), ts.ScriptTarget.Latest, true);
  let matcher = "";
  function visit(node: ts.Node) {
    if (ts.isPropertyAssignment(node) && node.name.getText(source) === "matcher" && ts.isArrayLiteralExpression(node.initializer)) {
      const value = node.initializer.elements[0];
      if (ts.isStringLiteral(value)) matcher = value.text;
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(matcher);
  const matches = (url: string) => unstable_doesMiddlewareMatch({ config: { matcher: [matcher] }, nextConfig: {}, url });
  assert.equal(matches("/googlee7fb30932b3ff81e.html"), false);
  for (const path of ["/sources", "/reading/private", "/api/documents", "/google-other.html", "/googlee7fb30932b3ff81e.html/private"]) {
    assert.equal(matches(path), true, `${path} must keep its auth gate`);
  }
  assert.equal(readFileSync("public/googlee7fb30932b3ff81e.html", "utf8"), "google-site-verification: googlee7fb30932b3ff81e.html");
});
