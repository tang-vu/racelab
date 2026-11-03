import test from "node:test";
import assert from "node:assert/strict";
import {
  investigateLive,
  hashSource,
} from "../deploy/cloudflare/src/live-agent.ts";
const source = "claimNextDue() { return null; }",
  candidate = "claimNextDue() { return followUpFromRow({}); }";
const bundle = {
  id: "tend-claims",
  adapter: "tend-sqlite-claim-v1",
  source: "claimNextDue() { /* pinned */ }",
  sourceHash: "pin",
  conditions: [{ id: "normal" }, { id: "crash-restart" }],
};
test("live protocol executes the model's actual proposal and retains the new input", async () => {
  const actions = [
    { action: "probe", condition: "crash-restart", hypothesis: "a lost claim" },
    { action: "patch", source: candidate, explanation: "a new proposal" },
  ];
  const calls = [],
    events = [];
  const result = await investigateLive(
    bundle,
    source,
    { sourceHash: await hashSource(source), verdict: { passed: false } },
    {
      chat: async () => ({
        text: JSON.stringify(actions.shift()),
        usage: { prompt_tokens: 10, completion_tokens: 10 },
        costUsd: 0.000012,
        receiptId: "receipt",
      }),
      execute: async (body) => {
        calls.push(body);
        return body.action === "run"
          ? {
              condition: body.condition,
              status: "completed",
              verdict: { passed: false, checks: [] },
            }
          : { passed: true, tested: 10, cases: [] };
      },
      emit: async (e) => events.push(e),
      cancelled: () => false,
    },
    "new-job",
  );
  assert.equal(result.startingSource, source);
  assert.equal(result.best.source, candidate);
  assert.equal(result.requests, 2);
  assert.equal(result.origin, "live_meta");
  assert.equal(result.outcome, "repaired_in_checked_conditions");
  assert.deepEqual(
    calls.map((c) => c.action),
    ["run", "verify"],
  );
  assert.equal(calls[1].source, candidate);
  assert.equal(events.filter((e) => e.type === "probe").length, 1);
  assert.equal(result.turns[0].assistant.tool_calls, undefined);
});
test("disconnection prevents a new paid model turn and mismatched executions fail closed", async () => {
  let paid = 0;
  const runtime = {
    chat: async () => {
      paid++;
      throw Error("unexpected");
    },
    execute: async () => ({}),
    emit: async () => {},
    cancelled: () => true,
  };
  const result = await investigateLive(
    bundle,
    source,
    { sourceHash: await hashSource(source) },
    runtime,
    "cancelled",
  );
  assert.equal(paid, 0);
  assert.match(result.error, /disconnected/);
  await assert.rejects(
    investigateLive(bundle, source, { sourceHash: "wrong" }, runtime, "bad"),
    /does not match/,
  );
});

test("invalid model formatting is retained as feedback and never executed as a candidate", async () => {
  const actions = [
    { action: "probe", condition: "normal" },
    { action: "probe", condition: "crash-restart" },
    { action: "patch", source: "function claimNextDue() { return null; }" },
    { action: "patch", source: candidate },
  ];
  const executed = [];
  const result = await investigateLive(
    bundle,
    source,
    { sourceHash: await hashSource(source), verdict: { passed: true } },
    {
      chat: async () => ({
        text: JSON.stringify(actions.shift()),
        usage: { prompt_tokens: 1, completion_tokens: 1 },
        costUsd: 0.000002,
        receiptId: "test",
      }),
      execute: async (body) => {
        executed.push(body);
        return body.action === "run"
          ? {
              condition: body.condition,
              verdict: { passed: false, checks: [] },
            }
          : { passed: true, tested: 10, cases: [] };
      },
      emit: async () => {},
      cancelled: () => false,
    },
    "format-feedback",
  );
  assert.equal(result.requests, 4);
  assert.match(result.turns[0].rejected, /already executed/);
  assert.match(result.turns[2].rejected, /claimNextDue/);
  assert.deepEqual(
    executed.map((body) => body.action),
    ["run", "verify"],
  );
  assert.equal(executed[1].source, candidate);
  assert.equal(result.best.verification.passed, true);
});
