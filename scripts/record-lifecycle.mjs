import { readFile, writeFile } from "node:fs/promises";
import { readConfig } from "../src/config.mjs";
import { loadTend, sourceHash } from "../src/workloads/tend-source.mjs";
import {
  lifecycleBaseline,
  lifecycleControl,
  verifyLifecycle,
  runLifecycle,
} from "../src/workloads/lifecycle-engine.mjs";
const bundle = await loadTend(readConfig().dataDirectory),
  old = JSON.parse(
    await readFile(
      new URL("../public/recordings/tend-claims.json", import.meta.url),
    ),
  );
const control = lifecycleControl(old.best.source),
  baseline = lifecycleBaseline(bundle);
const report = {
  version: 1,
  createdAt: new Date().toISOString(),
  engine: "tend-lifecycle-v2",
  attribution:
    "RaceLab-authored lifecycle control using the previously retained Meta claim method. renewClaim and completeClaim are authored controls, not new Meta proposals or upstream TEND repairs.",
  source: control,
  sourceHash: sourceHash(control),
  baselineSource: baseline,
  baseline: [
    await runLifecycle(bundle, baseline, "normal"),
    await runLifecycle(bundle, baseline, "renew"),
    await runLifecycle(
      bundle,
      lifecycleBaseline({ ...bundle, source: old.best.source }),
      "stale",
    ),
  ],
  verification: await verifyLifecycle(bundle, control),
  modelRequests: 0,
};
if (process.argv.includes("--record"))
  await writeFile(
    new URL("../public/recordings/lifecycle-validation.json", import.meta.url),
    JSON.stringify(report, null, 2) + "\n",
    { flag: "wx" },
  );
console.log(
  JSON.stringify({
    controlPassed: report.verification.passed,
    conditions: report.verification.tested,
    baseline: report.baseline.map((r) => ({
      condition: r.condition,
      passed: r.verdict.passed,
    })),
    modelRequests: 0,
  }),
);
