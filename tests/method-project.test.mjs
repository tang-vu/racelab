import test from "node:test";
import assert from "node:assert/strict";
import { extractClaimMethod, blankMethod } from "../public/method-project.js";
test("method imports isolate one method without executing file content", () => {
  const method =
    "claimNextDue(now = new Date()) {\n const sql = `SELECT '{ }'`; // }\n /* { */ return { sql };\n}";
  assert.equal(
    extractClaimMethod(
      "class Store {\n" + method + "\n other() { throw 'not executed'; }\n}",
    ),
    method,
  );
  assert.equal(extractClaimMethod(blankMethod), blankMethod);
  assert.throws(
    () => extractClaimMethod("export const arbitrary = 1;"),
    /No claimNextDue/,
  );
  assert.throws(
    () => extractClaimMethod("claimNextDue() { return '{';"),
    /complete method/,
  );
  assert.throws(() => extractClaimMethod("x".repeat(150001)), /150KB/);
});
