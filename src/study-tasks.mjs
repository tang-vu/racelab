import { loadTend, sourceHash } from "./workloads/tend-source.mjs";
import { runTend } from "./workloads/tend-engine.mjs";
import {
  lifecycleBaseline,
  LIFECYCLE_CONTRACT,
  verifyLifecycle,
} from "./workloads/lifecycle-engine.mjs";
import {
  loadRepositories,
  airulesSource,
  AIRULES_CONTRACT,
  verifyAirules,
} from "./workloads/repository-engine.mjs";
export async function studyTasks(directory) {
  const bundle = await loadTend(directory),
    inputs = await loadRepositories(directory);
  const claimDevelopment = ["normal", "crash-restart", "live-owner", "retry"];
  const claimHeld = [
    "expired-owner",
    "future",
    "completed",
    "mixed",
    "lease-edge",
    "different-input",
  ];
  const claims = async (source, split) => {
    const cases = [];
    for (const id of split === "development" ? claimDevelopment : claimHeld) {
      const run = await runTend(bundle, source, id);
      cases.push({ id, passed: run.verdict.passed, run });
    }
    return {
      passed: cases.every((c) => c.passed),
      tested: cases.length,
      cases,
    };
  };
  return [
    {
      id: "tend-claim",
      source: bundle.source,
      contract:
        "Repair only claimNextDue(now). Use the existing followUpFromRow(row) mapper. Due scheduled/retrying jobs or claimed jobs with claimed_at <= now-60000 are eligible, inclusive 60-second leases. Fresh claimed/future/completed jobs must not be stolen or replayed. Increment durable attempt_count once per acquisition; preserve all other payload fields, due dates and unrelated rows. Every write must be in this.database.transaction(fn)(). Database prepare supports bounded SELECT/UPDATE get/all/run on follow_ups. No network/files/imports. This v1 adapter has a fixed host generation guard for completion outside the candidate; you are repairing the claim method only.",
      development: claimDevelopment,
      heldOut: claimHeld,
      evaluate: claims,
    },
    {
      id: "tend-lifecycle",
      source: lifecycleBaseline(bundle),
      contract: LIFECYCLE_CONTRACT,
      development: ["normal", "recovery", "stale", "renew"],
      heldOut: [
        "competing",
        "before-commit",
        "after-commit",
        "expired-renew",
        "renew-boundary",
        "different-input",
      ],
      evaluate: (source, split) => verifyLifecycle(bundle, source, split),
    },
    {
      id: "airules-diff",
      source: airulesSource(inputs),
      contract: AIRULES_CONTRACT,
      development: ["unchanged", "added", "replacement"],
      heldOut: [
        "middle-insert",
        "middle-delete",
        "reordered",
        "trailing-empty",
        "omitted-known",
      ],
      evaluate: verifyAirules,
    },
  ].map((t) => ({ ...t, sourceHash: sourceHash(t.source) }));
}
export async function safeEvaluate(task, source, split) {
  try {
    return await task.evaluate(source, split);
  } catch (e) {
    return {
      passed: false,
      tested: 0,
      error: String(e.message ?? e).slice(0, 500),
      cases: [],
    };
  }
}
export function feedback(result) {
  return {
    passed: result.passed,
    error: result.error,
    cases: result.cases.map((c) => ({
      id: c.id,
      passed: c.passed,
      status: c.run.status,
      error: c.run.error,
      checks: c.run.verdict.checks,
    })),
  };
}
