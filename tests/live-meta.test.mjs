import test from "node:test";
import assert from "node:assert/strict";
import {
  requestMuse,
  museBody,
  museReply,
} from "../deploy/cloudflare/src/live-meta.ts";
test("public live repairs call the official Muse Spark API with server-only credentials", async () => {
  const messages = [{ role: "user", content: "A method, not a saved repair" }];
  let calls = 0;
  const response = await requestMuse(
    "private-test-key",
    messages,
    async (url, init) => {
      calls++;
      assert.equal(url, "https://api.meta.ai/v1/chat/completions");
      assert.equal(init.headers.Authorization, "Bearer private-test-key");
      const body = JSON.parse(init.body);
      assert.equal(body.model, "muse-spark-1.3");
      assert.equal(body.max_completion_tokens, 4096);
      assert.equal(body.store, false);
      assert.equal(body.response_format.type, "json_schema");
      assert.equal(init.redirect, "manual");
      assert.ok(!init.body.includes("private-test-key"));
      return Response.json({
        model: body.model,
        choices: [
          {
            message: { content: '{"action":"finish"}' },
            finish_reason: "stop",
          },
        ],
      });
    },
  );
  assert.equal(calls, 1);
  assert.equal(museReply(response), '{"action":"finish"}');
  assert.deepEqual(museBody(messages).messages, messages);
  assert.throws(
    () => museReply({ ...response, model: "llama-4" }),
    /did not confirm/,
  );
});
test("Meta transport failures are not retried or allowed to expose the key", async () => {
  let calls = 0;
  await assert.rejects(
    requestMuse("private-test-key", [], async () => {
      calls++;
      throw new Error("private-test-key");
    }),
    (error) =>
      !error.message.includes("private-test-key") &&
      /No automatic retry/.test(error.message),
  );
  assert.equal(calls, 1);
  await assert.rejects(
    requestMuse(
      "private-test-key",
      [],
      async () => new Response("private-test-key", { status: 503 }),
    ),
    /Meta returned HTTP 503/,
  );
});
