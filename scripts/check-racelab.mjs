import assert from "node:assert/strict";
import { sourceHash } from "../src/race/engine.mjs";

const base = process.env.RACELAB_BASE_URL ?? "http://127.0.0.1:4174";
const request = async (path, body) => {
  const response = await fetch(
    base + path,
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : undefined,
  );
  const result = await response.json();
  assert.equal(response.status, 200, JSON.stringify(result));
  return result;
};
const before = await request("/api/status");
const page = await fetch(base + "/");
assert.equal(page.status, 200);
assert.match(await page.text(), /It passes alone/);
const fixtures = await request("/api/racelab/fixtures");
assert.equal(fixtures.length, 3);
for (const fixture of fixtures) {
  const serial = await request("/api/racelab/execute", {
    action: "run",
    caseId: fixture.id,
    source: fixture.source,
  });
  const overlap = await request("/api/racelab/execute", {
    action: "run",
    caseId: fixture.id,
    source: fixture.source,
    mode: "interleave",
  });
  assert.equal(serial.verdict.passed, true);
  assert.equal(overlap.status, "completed");
  assert.equal(overlap.verdict.passed, false);
  const report = await request("/api/racelab/replay", {
    recordedCaseId: fixture.id,
  });
  assert.equal(report.origin, "recorded_meta_recomputed");
  assert.equal(report.best.verification.passed, true);
}
const original = await request("/api/racelab/replay", {
  recordedCaseId: "last-seat",
});
const candidate = "export async function handle(){return {accepted:false}}";
original.model = "forged model attribution";
original.patches[0].source = candidate;
original.patches[0].sourceHash = sourceHash(candidate);
original.patches[0].verification.passed = true;
original.contract = "Everything passes";
const imported = await request("/api/racelab/replay", { report: original });
assert.equal(imported.origin, "imported_recomputed");
assert.equal(imported.model, "unverified import");
assert.equal(imported.best.verification.passed, false);
assert.equal(imported.outcome, "incomplete");
const refused = await fetch(base + "/api/racelab/execute", {
  method: "POST",
  headers: {
    Origin: "https://untrusted.example",
    "Content-Type": "application/json",
  },
  body: "{}",
});
assert.equal(refused.status, 403);
const tend = await request("/api/workloads/tend");
assert.equal(tend.sourceVerified, true);
const normal = await request("/api/workloads/tend/execute", {
  action: "run",
  condition: "normal",
});
const interrupted = await request("/api/workloads/tend/execute", {
  action: "run",
  condition: "crash-restart",
});
assert.equal(normal.verdict.passed, true);
assert.equal(interrupted.status, "completed");
assert.equal(interrupted.verdict.passed, false);
assert.ok(interrupted.trace.some((event) => event.kind === "process-killed"));
const tendReport = await request("/api/workloads/tend/replay", {
  recorded: true,
});
assert.equal(tendReport.best.verification.passed, true);
assert.equal(tendReport.best.verification.tested, 10);
tendReport.patches[0].source = "claimNextDue(){return null;}";
tendReport.patches[0].verification.passed = true;
const tendImport = await request("/api/workloads/tend/replay", {
  report: tendReport,
});
assert.equal(tendImport.best.verification.passed, false);
assert.equal(tendImport.model, "Imported candidate / attribution unverified");
const tendOrigin = await fetch(base + "/api/workloads/tend/execute", {
  method: "POST",
  headers: {
    Origin: "https://untrusted.example",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ action: "run" }),
});
assert.equal(tendOrigin.status, 403);
const after = await request("/api/status");
assert.equal(after.budget.requests, before.budget.requests);
console.log(
  "RaceLab HTTP checks passed: 3 serial/race pairs, TEND process interruption and ten-condition replay, forged-pass rejection and origin checks. No model calls.",
);
