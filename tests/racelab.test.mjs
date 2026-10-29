import test from "node:test";
import assert from "node:assert/strict";
import { fixtures, fixtureFor } from "../src/race/fixtures.mjs";
import { runCase, execute, explore, verifyPatch } from "../src/race/engine.mjs";
import { raceJob } from "../src/race/runner.mjs";
import { investigateRace } from "../src/race/agent.mjs";

for (const fixture of fixtures) {
  test(`RaceLab ${fixture.id}: serial passes, a controlled overlap violates the contract`, async () => {
    const serial = await runCase(fixture.id, fixture.source, fixture.scenario);
    const overlap = await runCase(
      fixture.id,
      fixture.source,
      fixture.scenario,
      { strategy: "round-robin" },
    );
    assert.equal(serial.verdict.passed, true);
    assert.equal(overlap.status, "completed");
    assert.equal(overlap.verdict.passed, false);
    const replay = await runCase(fixture.id, fixture.source, fixture.scenario, {
      schedule: overlap.schedule,
    });
    assert.deepEqual(replay, overlap);
  });
}

test("RaceLab rejects a no-op patch, preserving the completion requirement", async () => {
  const fixture = fixtureFor("last-seat");
  const result = await verifyPatch(
    fixture,
    "export async function handle(){return {accepted:false}}",
    4,
  );
  assert.equal(result.passed, false);
  assert.ok(
    result.cases[0].firstFailure.verdict.violations.includes(
      "Available seats are filled",
    ),
  );
});

test("A correct mutex repair is checked on additional inputs; a bounded sweep is labelled", async () => {
  const fixture = fixtureFor("last-seat");
  // Test control only, not a bundled or model-attributed repair.
  const source = fixture.source
    .replace(
      "  const available",
      '  await db.lock("inventory");\n  try {\n  const available',
    )
    .replace(
      "  return { accepted: true };",
      '  return { accepted: true };\n  } finally { await db.unlock("inventory"); }',
    );
  const result = await verifyPatch(fixture, source, 40);
  assert.equal(result.passed, true);
  assert.equal(result.cases.length, 4);
  assert.ok(result.tested > 4);
  const limited = await explore(fixture.id, fixture.source, fixture.scenario, {
    limit: 1,
  });
  assert.equal(limited.exhaustive, false);
});

test("Guest code cannot obtain Node capabilities, import modules or spin forever", async () => {
  const scenario = { initial: {}, requests: [{}] };
  const capabilities = await execute(
    "export async function handle(){return [typeof process,typeof require,typeof fetch,typeof setTimeout]}",
    scenario,
  );
  assert.deepEqual(capabilities.results[0], [
    "undefined",
    "undefined",
    "undefined",
    "undefined",
  ]);
  const imported = await execute(
    'import fs from "node:fs"; export async function handle(){return fs}',
    scenario,
  );
  assert.equal(imported.status, "error");
  const spin = await execute(
    "export async function handle(){while(true){}}",
    scenario,
  );
  assert.equal(spin.status, "error");
});

test("The runner rejects blocked schedules and tracks deadlocks as errors", async () => {
  const fixture = fixtureFor("last-seat");
  const invalid = await runCase(fixture.id, fixture.source, fixture.scenario, {
    schedule: [1, 1, 1, 1, 1],
  });
  assert.equal(invalid.status, "error");
  const deadlock = await execute(
    'export async function handle(db){await db.lock("a");await db.lock("a")}',
    { initial: {}, requests: [{}] },
  );
  assert.match(deadlock.error, /Deadlock/);
});

test("Guest code cannot erase append-only effects or write prototype keys", async () => {
  const fixture = fixtureFor("last-seat");
  for (const call of [
    'await db.set("orders",[])',
    'await db.set("__proto__",{})',
  ]) {
    const result = await runCase(
      fixture.id,
      `export async function handle(db){${call};return {accepted:false}}`,
      fixture.scenario,
    );
    assert.equal(result.status, "error");
    assert.equal(result.verdict.passed, false);
  }
});

test("The worker executes the same handler and contract with an empty environment", async () => {
  const fixture = fixtureFor("last-seat");
  const result = await raceJob("run", {
    caseId: fixture.id,
    source: fixture.source,
    mode: "interleave",
  });
  assert.equal(result.status, "completed");
  assert.equal(result.verdict.passed, false);
});

test("A model's confident completion message cannot manufacture a repaired verdict", async () => {
  const result = await investigateRace(
    {
      config: { model: "test" },
      chat: async () => ({
        message: { content: "Fixed everything. PASS." },
        costUsd: 0,
      }),
    },
    { caseId: "last-seat" },
  );
  assert.equal(result.outcome, "incomplete");
  assert.equal(result.best, null);
});

test("An interrupted model run retains its executed probe without retrying", async () => {
  let requests = 0;
  const result = await investigateRace(
    {
      config: { model: "test" },
      chat: async () => {
        requests++;
        if (requests === 2) throw new Error("Connection interrupted");
        return {
          costUsd: 0.01,
          message: {
            tool_calls: [
              {
                id: "probe",
                function: {
                  name: "probe_schedule",
                  arguments: JSON.stringify({
                    hypothesis: "Both buyers read first",
                    schedule: [0, 1],
                  }),
                },
              },
            ],
          },
        };
      },
    },
    { caseId: "last-seat" },
  );
  assert.equal(requests, 2);
  assert.equal(result.probes.length, 1);
  assert.equal(result.probes[0].run.verdict.passed, false);
  assert.equal(result.outcome, "incomplete");
  assert.equal(result.costUsd, null);
  assert.match(result.error, /interrupted/);
});

test("Excess model tool calls produce a retained incomplete result", async () => {
  const result = await investigateRace(
    {
      config: { model: "test" },
      chat: async () => ({ costUsd: 0, message: { tool_calls: [{}, {}, {}] } }),
    },
    { caseId: "last-seat" },
  );
  assert.equal(result.requests, 1);
  assert.equal(result.baseline.verdict.passed, true);
  assert.equal(result.outcome, "incomplete");
  assert.match(result.error, /tool limit/);
});
