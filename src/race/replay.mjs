import { fixtureFor, validateSource } from "./fixtures.mjs";
import { sourceHash, ENGINE_VERSION } from "./engine.mjs";
import { raceJob } from "./runner.mjs";

export async function replayInvestigation(record, trustedRecording = false) {
  const fixture = fixtureFor(record?.caseId);
  const source = validateSource(record.startingSource);
  if (
    record.version !== 1 ||
    !Array.isArray(record.probes) ||
    record.probes.length > 3 ||
    !Array.isArray(record.patches) ||
    record.patches.length > 2
  )
    throw new Error("This is not a supported RaceLab report.");
  if (
    record.startingSourceHash &&
    record.startingSourceHash !== sourceHash(source)
  )
    throw new Error("The report's starting source hash does not match.");
  const baseline = await raceJob("run", { caseId: fixture.id, source });
  const probes = [];
  for (const probe of record.probes) {
    if (!Array.isArray(probe?.run?.schedule))
      throw new Error("A probe has no replayable schedule.");
    const run = await raceJob("run", {
      caseId: fixture.id,
      source,
      schedule: probe.run.schedule,
    });
    probes.push({
      hypothesis: String(probe.hypothesis ?? "Imported schedule").slice(
        0,
        1200,
      ),
      run,
    });
  }
  const patches = [];
  for (const patch of record.patches) {
    const candidate = validateSource(patch.source);
    if (patch.sourceHash && patch.sourceHash !== sourceHash(candidate))
      throw new Error("A candidate source hash does not match.");
    const verification = await raceJob("verify", {
      caseId: fixture.id,
      source: candidate,
      limit: 40,
    });
    patches.push({
      source: candidate,
      sourceHash: sourceHash(candidate),
      explanation: String(patch.explanation ?? "Imported candidate").slice(
        0,
        1600,
      ),
      verification,
    });
  }
  const best =
    patches.find((patch) => patch.verification.passed) ??
    patches.at(-1) ??
    null;
  return {
    version: 1,
    engine: ENGINE_VERSION,
    caseId: fixture.id,
    contract: fixture.invariant,
    scenario: fixture.scenario,
    startingSource: source,
    startingSourceHash: sourceHash(source),
    baseline,
    probes,
    patches,
    best,
    model: trustedRecording ? record.model : "unverified import",
    createdAt: trustedRecording ? record.createdAt : null,
    requests: trustedRecording ? record.requests : null,
    costUsd: trustedRecording ? record.costUsd : null,
    origin: trustedRecording
      ? "recorded_meta_recomputed"
      : "imported_recomputed",
    outcome:
      best?.verification.passed &&
      probes.some(
        (probe) =>
          probe.run.status === "completed" && !probe.run.verdict.passed,
      )
        ? "repaired_in_checked_schedules"
        : "incomplete",
    summary:
      "All execution results were recomputed locally. Imported claims and pass flags are not trusted.",
    events: [],
  };
}
