import { parentPort, workerData } from "node:worker_threads";
import { fixtureFor, validateSource } from "./fixtures.mjs";
import { runCase, explore, verifyPatch } from "./engine.mjs";

try {
  const { action, input } = workerData;
  const fixture = fixtureFor(input.caseId);
  const source = validateSource(input.source ?? fixture.source);
  let result;
  if (action === "run")
    result = await runCase(fixture.id, source, fixture.scenario, {
      strategy: input.mode === "interleave" ? "round-robin" : "serial",
      ...(input.schedule ? { schedule: input.schedule } : {}),
    });
  else if (action === "search")
    result = await explore(fixture.id, source, fixture.scenario, {
      limit: input.limit ?? 64,
      strategy: input.strategy ?? "dfs",
      stopOnFailure: input.stopOnFailure ?? false,
    });
  else if (action === "verify")
    result = await verifyPatch(fixture, source, input.limit ?? 40);
  else throw new Error("Unknown RaceLab operation.");
  parentPort.postMessage({ result });
} catch (error) {
  parentPort.postMessage({
    error: String(error?.message ?? error).slice(0, 600),
  });
}
