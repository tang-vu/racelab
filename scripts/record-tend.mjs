import { readFile, writeFile, mkdir } from "node:fs/promises";
import { readConfig } from "../src/config.mjs";
import { openLedger } from "../src/budget.mjs";
import { MetaClient } from "../src/meta.mjs";
import { loadTend } from "../src/workloads/tend-source.mjs";
import { investigateTend, replayTend } from "../src/workloads/tend-agent.mjs";
import assert from "node:assert/strict";
const path = new URL("../public/recordings/tend-claims.json", import.meta.url);
const reportArg = process.argv
  .find((arg) => arg.startsWith("--report="))
  ?.slice(9);
const verdict = (run) => ({
  ...run.verdict,
  checks: run.verdict.checks.map((check) =>
    check.name === "Killed worker exited before restart"
      ? { ...check, actual: Boolean(check.actual) }
      : check,
  ),
});
const config = readConfig(),
  bundle = await loadTend(config.dataDirectory, {
    fetchMissing: process.argv.includes("--prepare"),
  });
if (process.argv.includes("--live")) {
  try {
    await readFile(path);
    throw new Error(
      "A TEND investigation is retained; it will not be overwritten or retried.",
    );
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const ledger = await openLedger(config),
    client = new MetaClient(config, ledger);
  const record = await investigateTend(
    client,
    bundle,
    bundle.source,
    (event) => {
      if (["model", "checking", "rejected", "error"].includes(event.type))
        console.log(event.type, event.message);
      if (event.type === "patch")
        console.log(
          "patch",
          JSON.stringify({
            passed: event.patch.verification.passed,
            conditions: event.patch.verification.tested,
          }),
        );
    },
  );
  await mkdir(new URL("../public/recordings/", import.meta.url), {
    recursive: true,
  });
  await writeFile(path, JSON.stringify(record, null, 2) + "\n", { flag: "wx" });
  console.log(
    JSON.stringify({
      outcome: record.outcome,
      requests: record.requests,
      costUsd: record.costUsd,
      conditions: record.best?.verification.tested ?? 0,
    }),
  );
} else {
  const record = JSON.parse(await readFile(reportArg ?? path, "utf8"));
  const replay = await replayTend(record, bundle, !reportArg);
  assert.equal(replay.outcome, record.outcome);
  assert.equal(replay.baseline.verdict.passed, record.baseline.verdict.passed);
  assert.deepEqual(
    replay.probes.map((item) => verdict(item.run)),
    record.probes.map((item) => verdict(item.run)),
  );
  assert.deepEqual(
    replay.patches.map((item) => ({
      passed: item.verification.passed,
      cases: item.verification.cases.map((c) => ({
        id: c.id,
        passed: c.passed,
        verdict: verdict(c.run),
      })),
    })),
    record.patches.map((item) => ({
      passed: item.verification.passed,
      cases: item.verification.cases.map((c) => ({
        id: c.id,
        passed: c.passed,
        verdict: verdict(c.run),
      })),
    })),
  );
  console.log(
    `TEND recorded investigation recomputed: ${replay.best?.verification.tested ?? 0} conditions, ${replay.outcome}. No model calls.`,
  );
}
