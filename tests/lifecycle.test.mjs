import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { loadTend } from "../src/workloads/tend-source.mjs";
import {
  lifecycleBaseline,
  lifecycleControl,
  verifyLifecycle,
  runLifecycle,
} from "../src/workloads/lifecycle-engine.mjs";
test(
  "real lifecycle workers handle contention, transaction interruption, renewal and stale tokens",
  { timeout: 90000 },
  async () => {
    const bundle = await loadTend(
      fileURLToPath(new URL("../.racelab/", import.meta.url)),
    );
    const record = JSON.parse(
      await readFile(
        new URL("../public/recordings/tend-claims.json", import.meta.url),
      ),
    );
    const result = await verifyLifecycle(
      bundle,
      lifecycleControl(record.best.source),
    );
    assert.equal(result.tested, 10);
    assert.ok(
      result.passed,
      JSON.stringify(
        result.cases.filter((c) => !c.passed),
        null,
        2,
      ),
    );
    for (const id of ["before-commit", "after-commit"])
      assert.ok(
        result.cases
          .find((c) => c.id === id)
          .run.trace.some((e) => e.kind === "process-killed" && e.pid),
      );
    const competing = result.cases.find((c) => c.id === "competing").run;
    assert.equal(
      new Set(
        competing.trace
          .filter((e) => e.kind === "process-start")
          .map((e) => e.pid),
      ).size,
      2,
    );
    const baseline = await runLifecycle(
      bundle,
      lifecycleBaseline(bundle),
      "renew",
    );
    assert.equal(baseline.verdict.passed, false);
    const noRenew = lifecycleBaseline({
      ...bundle,
      source: record.best.source,
    });
    const stale = await runLifecycle(bundle, noRenew, "stale");
    assert.equal(stale.verdict.passed, false);
    assert.ok(
      stale.verdict.checks.some(
        (c) => c.name === "Stale token cannot complete" && !c.passed,
      ),
    );
  },
);
