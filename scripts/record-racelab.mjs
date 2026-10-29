import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { fixtures, fixtureFor } from "../src/race/fixtures.mjs";
import { sourceHash } from "../src/race/engine.mjs";
import { raceJob } from "../src/race/runner.mjs";
import { investigateRace } from "../src/race/agent.mjs";
import { replayInvestigation } from "../src/race/replay.mjs";
import { readConfig } from "../src/config.mjs";
import { openLedger } from "../src/budget.mjs";
import { MetaClient } from "../src/meta.mjs";

const directory = fileURLToPath(
  new URL("../public/recordings/", import.meta.url),
);
const selected = process.argv
  .find((arg) => arg.startsWith("--case="))
  ?.split("=")[1];
if (process.argv.includes("--live")) {
  const fixture = fixtureFor(selected);
  const path = `${directory}${fixture.id}.json`;
  try {
    await readFile(path);
    throw new Error(
      "A retained investigation already exists. It will not be overwritten or retried.",
    );
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const config = readConfig();
  const ledger = await openLedger(config);
  const client = new MetaClient(config, ledger);
  const result = await investigateRace(
    client,
    { caseId: fixture.id, source: fixture.source },
    (event) => {
      if (["model", "checking", "rejected"].includes(event.type))
        console.log(event.type, event.message);
      if (event.type === "patch")
        console.log(
          "patch",
          JSON.stringify({
            passed: event.patch.verification.passed,
            tested: event.patch.verification.tested,
          }),
        );
    },
  );
  const serial = await raceJob("run", {
    caseId: fixture.id,
    source: fixture.source,
  });
  const roundRobin = await raceJob("run", {
    caseId: fixture.id,
    source: fixture.source,
    mode: "interleave",
  });
  const random = await raceJob("search", {
    caseId: fixture.id,
    source: fixture.source,
    strategy: "random",
    limit: 1,
  });
  result.comparison = {
    serial: serial.verdict,
    roundRobin: roundRobin.verdict,
    seededRandom: { tested: random.tested, failed: random.failed },
    note: "Simple scheduling baselines may also expose these authored bugs. Meta's patch is generated during the recorded investigation.",
  };
  await mkdir(directory, { recursive: true });
  await writeFile(path, JSON.stringify(result, null, 2) + "\n", { flag: "wx" });
  console.log(
    JSON.stringify({
      caseId: fixture.id,
      outcome: result.outcome,
      requests: result.requests,
      costUsd: result.costUsd,
      schedules: result.best?.verification.tested ?? 0,
    }),
  );
} else {
  let checked = 0;
  for (const fixture of fixtures.filter(
    (item) => !selected || item.id === selected,
  )) {
    let record;
    try {
      record = JSON.parse(
        await readFile(`${directory}${fixture.id}.json`, "utf8"),
      );
    } catch (error) {
      if (error.code === "ENOENT") {
        console.log(`${fixture.id}: no recorded investigation yet`);
        continue;
      }
      throw error;
    }
    assert.equal(record.startingSourceHash, sourceHash(record.startingSource));
    for (const probe of record.probes) {
      const replay = await raceJob("run", {
        caseId: fixture.id,
        source: record.startingSource,
        schedule: probe.run.schedule,
      });
      assert.deepEqual(replay.verdict, probe.run.verdict);
      assert.deepEqual(replay.state, probe.run.state);
    }
    for (const patch of record.patches) {
      assert.equal(patch.sourceHash, sourceHash(patch.source));
      const result = await raceJob("verify", {
        caseId: fixture.id,
        source: patch.source,
        limit: 40,
      });
      assert.equal(result.passed, patch.verification.passed);
      assert.equal(result.tested, patch.verification.tested);
      assert.equal(result.exhaustive, patch.verification.exhaustive);
    }
    checked++;
    console.log(
      `${fixture.id}: ${record.outcome}; recorded source/probes/patches recomputed offline`,
    );
  }
  console.log(`${checked} recorded investigation(s) verified. No model calls.`);
  if (!selected) {
    const ui = JSON.parse(
      await readFile(
        new URL("../demo/racelab-ui-result.json", import.meta.url),
        "utf8",
      ),
    );
    const recomputed = await replayInvestigation(ui);
    assert.equal(recomputed.outcome, ui.outcome);
    assert.equal(
      recomputed.best.verification.tested,
      ui.best.verification.tested,
    );
    assert.equal(recomputed.model, "unverified import");
    console.log(
      "Separate edited-source UI integration result recomputed offline.",
    );
  }
}
