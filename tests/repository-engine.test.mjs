import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import {
  loadRepositories,
  validateOpenMusic,
  airulesSource,
  verifyAirules,
  runAirules,
} from "../src/workloads/repository-engine.mjs";
const directory = fileURLToPath(new URL("../.racelab/", import.meta.url));
test("pinned owned repository code retains healthy controls and new-contract failures", async () => {
  const inputs = await loadRepositories(directory),
    music = await validateOpenMusic(inputs),
    diff = await verifyAirules(airulesSource(inputs));
  assert.equal(music.passed, true);
  assert.equal(music.tested, 14);
  assert.deepEqual(
    diff.cases.filter((c) => !c.passed).map((c) => c.id),
    ["replacement", "reordered"],
  );
});
test("guest proposals cannot access Node, write files or run forever", async () => {
  for (const body of [
    "return process.env",
    "while(true){}",
    "return require('node:fs').readFileSync('x')",
  ]) {
    const run = await runAirules(`function diffSync(){${body}}`, "replacement");
    assert.equal(run.status, "error");
    assert.equal(run.verdict.passed, false);
  }
});
