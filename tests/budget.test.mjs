import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BudgetLedger } from "../src/budget.mjs";

async function ledger(t, policy = { total: 150, phase: 10, reserve: 50 }) {
  const dir = await mkdtemp(join(tmpdir(), "racelab-budget-"));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return new BudgetLedger(dir, policy);
}
test("reserves before spending and refuses requests that exceed the phase cap", async (t) => {
  const b = await ledger(t);
  const id = await b.reserve("spark", 6);
  await assert.rejects(b.reserve("spark", 5));
  await b.settle(id, 0.01, { input: 1000, output: 100 });
  assert.equal((await b.summary()).spentUsd, 0.01);
  assert.equal((await b.summary()).heldUsd, 0);
});
test("an uncertain charge is accounted conservatively and stops subsequent paid calls", async (t) => {
  const b = await ledger(t);
  const id = await b.reserve("spark", 1.4);
  await b.settle(id, null);
  assert.equal((await b.summary()).spentUsd, 1.4);
  await assert.rejects(b.reserve("spark", 0.01));
});
test("pending reservations survive a restart and cannot be spent twice", async (t) => {
  const b = await ledger(t);
  await b.reserve("spark", 9);
  const afterRestart = new BudgetLedger(b.directory, b.policy);
  await assert.rejects(afterRestart.reserve("spark", 2));
});

test("an explicit conservative review preserves every charged cent and phase limits", async (t) => {
  const b = await ledger(t, { total: 150, phase: 2, reserve: 50 });
  const id = await b.reserve("spark", 1.4);
  await b.settle(id, null);
  await assert.rejects(b.acceptConservativeDebit(id, "short"));
  const before = await b.read();
  await b.acceptConservativeDebit(
    id,
    "Accept the entire reserved maximum as spent; actual provider billing remains unknown.",
  );
  const after = await b.read();
  assert.equal(after.entries.length, before.entries.length);
  assert.equal(after.entries[0].status, "uncertain");
  assert.equal(after.entries[0].chargedMicros, before.entries[0].chargedMicros);
  assert.equal(
    after.entries[0].reservedMicros,
    before.entries[0].reservedMicros,
  );
  assert.equal((await b.summary()).spentUsd, 1.4);
  assert.equal((await b.summary()).blocked, null);
  await assert.rejects(b.reserve("spark", 0.7));
  await b.reserve("spark", 0.5);
  await assert.rejects(
    b.acceptConservativeDebit(
      id,
      "Duplicate review must never restore a budget or change its debit.",
    ),
  );
});
test("reviewing one debit cannot clear another unresolved charge", async (t) => {
  const b = await ledger(t),
    a = await b.reserve("spark", 1),
    c = await b.reserve("spark", 1);
  await b.settle(a, null);
  await b.settle(c, null);
  await b.acceptConservativeDebit(
    a,
    "Accept this full reserved debit without changing the other unresolved charge.",
  );
  assert.ok((await b.summary()).blocked);
  await assert.rejects(b.reserve("spark", 0.1));
});

test("reservation metadata cannot override accounting fields", async (t) => {
  const b = await ledger(t);
  const id = await b.reserve("spark", 1.4, {
    id: "forged",
    status: "settled",
    reservedMicros: 0,
    chargedMicros: 0,
  });
  assert.notEqual(id, "forged");
  assert.equal((await b.summary()).heldUsd, 1.4);
  await b.settle(id, 0.01);
  assert.equal((await b.summary()).spentUsd, 0.01);
});
test("corrupted records fail closed instead of resetting the budget", async (t) => {
  const b = await ledger(t);
  await writeFile(b.path, "{broken");
  await assert.rejects(b.reserve("spark", 0.01));
});
test("concurrent reservations cannot oversubscribe the budget", async (t) => {
  const b = await ledger(t, { total: 150, phase: 1, reserve: 50 });
  const results = await Promise.allSettled(
    Array.from({ length: 8 }, () => b.reserve("spark", 0.6)),
  );
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal((await b.summary()).heldUsd, 0.6);
});
