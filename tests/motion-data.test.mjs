import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chapterSteps, replayFrame } from "../public/motion-data.js";
import { fixtureFor } from "../src/race/fixtures.mjs";
import { runCase } from "../src/race/engine.mjs";

test("Scroll chapters scrub actual committed frames without exposing future reads", async () => {
  for (const id of ["last-seat", "webhook", "lost-update"]) {
    const fixture = fixtureFor(id);
    const run = await runCase(id, fixture.source, fixture.scenario, {
      strategy: "round-robin",
    });
    const [first, second, last] = chapterSteps(run, id);
    assert.ok(first > 0 && first <= second && second <= last);
    assert.equal(last, run.trace.length);
    const initial = replayFrame(fixture, run, 0);
    assert.equal(initial.readA, undefined);
    assert.equal(initial.readB, undefined);
    assert.equal(initial.verdict, "REPLAY");
    const firstRead = run.trace.find((event) => event.method === "get");
    const readFrame = replayFrame(fixture, run, firstRead.step);
    assert.deepEqual(readFrame.readA, firstRead.result);
    assert.equal(readFrame.readB, undefined);
    const shared = replayFrame(fixture, run, first);
    assert.equal(shared.sharedRead, true);
    assert.deepEqual(shared.readA, shared.readB);
    const end = replayFrame(fixture, run, last);
    assert.equal(end.verdict, "FAIL");
    assert.equal(end.impact.expected, initial.impact.expected);
    assert.notEqual(end.impact.actual, end.impact.expected);
    assert.equal(
      end.memory,
      Array.isArray(run.state[end.key])
        ? run.state[end.key].length
        : run.state[end.key],
    );
    assert.deepEqual(replayFrame(fixture, run, -99), initial);
    assert.deepEqual(replayFrame(fixture, run, Infinity), end);
  }
});

test("Serialized and repaired executions retain their own verdict and read provenance", async () => {
  const fixture = fixtureFor("last-seat");
  const serial = await runCase(fixture.id, fixture.source, fixture.scenario);
  assert.equal(
    replayFrame(fixture, serial, serial.trace.length).verdict,
    "PASS",
  );
  assert.equal(
    replayFrame(fixture, serial, chapterSteps(serial, fixture.id)[0])
      .sharedRead,
    false,
  );
  const recording = JSON.parse(
    await readFile(
      new URL("../public/recordings/last-seat.json", import.meta.url),
    ),
  );
  const candidate = await runCase(
    fixture.id,
    recording.patches[0].source,
    fixture.scenario,
    { strategy: "round-robin" },
  );
  const frame = replayFrame(fixture, candidate, candidate.trace.length);
  assert.equal(frame.verdict, "PASS");
  assert.equal(frame.impact.actual, frame.impact.expected);
  for (const actor of [0, 1]) {
    const read = candidate.trace.findLast(
      (event) =>
        event.actor === actor &&
        event.method === "get" &&
        event.key === "stock",
    );
    assert.deepEqual(actor === 0 ? frame.readA : frame.readB, read?.result);
  }
  assert.deepEqual(chapterSteps(null, fixture.id), [0, 0, 0]);
  assert.equal(replayFrame(fixture, null, 6), null);
});
