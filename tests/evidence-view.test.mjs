import test from "node:test";
import assert from "node:assert/strict";
import {
  collisionPair,
  impactFor,
  highlightSource,
} from "../public/evidence-view.js";
import { fixtureFor } from "../src/race/fixtures.mjs";
import { runCase } from "../src/race/engine.mjs";

test("The shared-read jump comes from the failed trace, not a case-specific step", async () => {
  for (const id of ["last-seat", "webhook", "lost-update"]) {
    const fixture = fixtureFor(id);
    const serial = await runCase(id, fixture.source, fixture.scenario);
    assert.equal(collisionPair(serial, id), null);
    const overlap = await runCase(id, fixture.source, fixture.scenario, {
      strategy: "round-robin",
    });
    const pair = collisionPair(overlap, id);
    assert.ok(pair);
    const a = overlap.trace[pair.first - 1],
      b = overlap.trace[pair.second - 1];
    assert.notEqual(a.actor, b.actor);
    assert.equal(a.key, b.key);
    assert.deepEqual(a.result, b.result);
    const changed = structuredClone(overlap);
    changed.trace.splice(1, 0, { method: "set", key: a.key });
    assert.equal(collisionPair(changed, id), null);
  }
});

test("The impact number follows committed memory and retains the fixed input target", async () => {
  for (const id of ["last-seat", "webhook", "lost-update"]) {
    const fixture = fixtureFor(id);
    const run = await runCase(id, fixture.source, fixture.scenario, {
      strategy: "round-robin",
    });
    const before = impactFor(fixture, fixture.scenario.initial);
    const after = impactFor(fixture, run.state);
    assert.equal(before.expected, after.expected);
    assert.notEqual(before.actual, after.actual);
    assert.notEqual(after.actual, after.expected);
  }
});

test("Source highlighting keeps untrusted handler text as escaped text", () => {
  const source =
    'export async function handle() { return "<script>alert(1)</script>"; } // <img src=x onerror=alert(1)>';
  const highlighted = highlightSource(source);
  assert.doesNotMatch(highlighted, /<script|<img/);
  assert.match(highlighted, /&lt;script&gt;/);
  assert.match(highlighted, /token-string/);
  assert.match(highlighted, /token-comment/);
});
