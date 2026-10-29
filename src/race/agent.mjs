import { randomUUID } from "node:crypto";
import { fixtureFor, validateSource } from "./fixtures.mjs";
import { sourceHash, ENGINE_VERSION } from "./engine.mjs";
import { raceJob } from "./runner.mjs";

const object = (properties) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
const tool = (name, description, properties) => ({
  type: "function",
  function: { name, description, strict: true, parameters: object(properties) },
});
export const raceTools = [
  tool(
    "probe_schedule",
    "Execute the unchanged starting JavaScript with your chosen request-index prefix at asynchronous store boundaries. Indices start at 0. Once the prefix ends, run the lowest eligible request. An invalid/blocked index is an error. Read the actual trace and independent contract checks. Probe at least once before proposing a patch.",
    {
      hypothesis: { type: "string" },
      schedule: { type: "array", items: { type: "integer" } },
    },
  ),
  tool(
    "test_patch",
    "Execute a complete replacement JavaScript ES module exporting handle(db, request). The immutable external contract and scenario matrix score it. No test edits. Returns failures if the patch loses work, lies in responses, duplicates effects, deadlocks or changes unrelated state. At most two patch proposals.",
    {
      explanation: { type: "string" },
      source: { type: "string" },
    },
  ),
];

const compactRun = (run) => ({
  status: run.status,
  error: run.error,
  state: run.state,
  results: run.results,
  schedule: run.schedule,
  verdict: run.verdict,
  trace: run.trace
    .slice(0, 30)
    .map(({ step, actor, method, key, args, result }) => ({
      step,
      actor,
      method,
      key,
      args,
      result,
    })),
});

export async function investigateRace(client, input, emit = () => {}) {
  const fixture = fixtureFor(input.caseId);
  const source = validateSource(input.source ?? fixture.source);
  const runId = randomUUID();
  const events = [];
  const publish = (event) => {
    const item = { ...event, sequence: events.length + 1 };
    events.push(item);
    emit(item);
  };
  const baseline = await raceJob("run", {
    caseId: fixture.id,
    source,
    mode: "serial",
  });
  publish({
    type: "baseline",
    message: "The sequential execution has been checked.",
    run: baseline,
  });
  const probes = [];
  const patches = [];
  let requests = 0;
  let costUsd = 0;
  let summary = "";
  let operationError = null;
  let patchAttempts = 0;
  const messages = [
    {
      role: "system",
      content: `You are RaceLab's concurrency investigator and repair agent. Execute experiments; use observations, not intuition alone. Your source is real JavaScript running in isolated QuickJS, with a controlled asynchronous store, NOT arbitrary Node.js or a real database. Return public concise hypotheses, evidence and patch explanations, not private chain of thought.
Every db method is async and is one atomic scheduling boundary. API: get(key) returns a JSON clone or null; set(key,value) writes a scalar/object and returns true; append(key,record) adds to an EXISTING append-only collection and returns its length; compareAndSwap(key,expected,replacement) compares JSON structurally, atomically replaces it and returns boolean; insertOnce(key,value) atomically writes only when the key is ABSENT (null is still present), returns boolean; lock(key) is an exclusive, non-reentrant asynchronous mutex; unlock(key) only by its owner. Locks may use arbitrary key names and do not create store records. Receipt collections cannot be overwritten. All requests in a run share the module and store; each request must finish and release its locks. No process, require, filesystem, imports, fetch, timers, Date or Math.random. Maximum 96 store operations/run. Export async function handle(db, request). Preserve the exact response protocol.
TASK: ${fixture.description}
LOCKED CONTRACT: ${fixture.invariant}
SCENARIO: ${JSON.stringify(fixture.scenario)}
STARTING SOURCE:\n${source}
SEQUENTIAL EXECUTION: ${JSON.stringify(compactRun(baseline))}
First call probe_schedule with a deliberate interleaving derived from the code. Request indices 0..${fixture.scenario.requests.length - 1}. Probe the original code even if serial already fails. Then use the observed race to propose a source patch with test_patch. A tool will run the SAME fixed contract on the original scenario AND additional inputs, including three requests, no stock, unique/repeated events and other deltas as applicable. Preserve input-dependent behavior and unrelated store keys. Do not hardcode sample values or request identities. The verifier, scenarios and scheduler are immutable. At most 6 model turns, 3 probes, 2 patches. If a patch fails, inspect the feedback and revise within that limit. A passing bounded sweep is evidence only for its recorded schedules. Never claim general correctness, all possible interleavings, a novel bug or production validation.`,
    },
    {
      role: "user",
      content:
        "Find an actual concurrency failure, then repair the handler and test the repair. Keep the measured result even if the repair fails.",
    },
  ];
  for (let turn = 0; turn < 6; turn++) {
    publish({
      type: "model",
      message: `Muse Spark is investigating · turn ${turn + 1}/6`,
    });
    requests++;
    let response;
    try {
      response = await client.chat(messages, {
        maxOutput: 3000,
        tools: { tools: raceTools, parallel_tool_calls: false },
      });
    } catch (error) {
      operationError = error.message;
      publish({ type: "rejected", message: operationError });
      break;
    }
    costUsd += response.costUsd ?? 0;
    const message = response.message;
    const calls = message.tool_calls ?? [];
    if (!calls.length) {
      summary =
        typeof message.content === "string"
          ? message.content.slice(0, 2400)
          : "";
      break;
    }
    if (calls.length > 2) {
      operationError = "The model exceeded this turn's tool limit.";
      publish({ type: "rejected", message: operationError });
      break;
    }
    messages.push({
      role: "assistant",
      content: message.content ?? null,
      tool_calls: calls,
    });
    for (const call of calls) {
      let observation;
      try {
        const args = JSON.parse(call.function.arguments);
        if (call.function.name === "probe_schedule") {
          if (probes.length >= 3)
            throw new Error("The three-probe limit has been reached.");
          if (typeof args.hypothesis !== "string")
            throw new Error("A public hypothesis is required.");
          if (!Array.isArray(args.schedule))
            throw new Error("A probe requires a schedule array.");
          const run = await raceJob("run", {
            caseId: fixture.id,
            source,
            schedule: args.schedule,
          });
          const probe = { hypothesis: args.hypothesis.slice(0, 1200), run };
          probes.push(probe);
          publish({ type: "probe", message: probe.hypothesis, probe });
          observation = compactRun(run);
        } else if (call.function.name === "test_patch") {
          if (!probes.length)
            throw new Error(
              "Probe the starting handler before proposing a patch.",
            );
          if (patchAttempts >= 2)
            throw new Error("The two-patch limit has been reached.");
          patchAttempts++;
          const candidate = validateSource(args.source);
          if (candidate === source)
            throw new Error("The candidate source is unchanged.");
          publish({
            type: "checking",
            message:
              "Executing the proposed source against the locked contract and additional inputs…",
          });
          let verification;
          try {
            verification = await raceJob("verify", {
              caseId: fixture.id,
              source: candidate,
              limit: 40,
            });
          } catch (error) {
            verification = {
              passed: false,
              exhaustive: false,
              tested: 0,
              failures: 0,
              cases: [],
              error: error.message,
            };
          }
          const patch = {
            source: candidate,
            sourceHash: sourceHash(candidate),
            explanation: String(args.explanation ?? "").slice(0, 1600),
            verification,
          };
          patches.push(patch);
          publish({ type: "patch", message: patch.explanation, patch });
          observation = {
            passed: verification.passed,
            exhaustive: verification.exhaustive,
            tested: verification.tested,
            cases: verification.cases.map((item) => ({
              scenario: item.scenario,
              tested: item.tested,
              failed: item.failed,
              exhaustive: item.exhaustive,
              firstFailure: item.firstFailure
                ? compactRun(item.firstFailure)
                : null,
            })),
          };
        } else throw new Error("Unknown RaceLab tool.");
      } catch (error) {
        observation = { error: error.message };
        publish({ type: "rejected", message: error.message });
      }
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(observation),
      });
    }
    if (patches.at(-1)?.verification.passed) break;
  }
  const best =
    patches.find((patch) => patch.verification.passed) ??
    patches.at(-1) ??
    null;
  return {
    version: 1,
    engine: ENGINE_VERSION,
    runId,
    createdAt: new Date().toISOString(),
    caseId: fixture.id,
    startingSource: source,
    startingSourceHash: sourceHash(source),
    contract: fixture.invariant,
    scenario: fixture.scenario,
    model: client.config?.model ?? "test-client",
    baseline,
    probes,
    patches,
    best,
    summary,
    requests,
    costUsd: operationError ? null : Number(costUsd.toFixed(6)),
    error: operationError,
    outcome:
      best?.verification.passed &&
      probes.some(
        (probe) =>
          !probe.run.verdict.passed && probe.run.status === "completed",
      )
        ? "repaired_in_checked_schedules"
        : "incomplete",
    scope:
      "Authored handlers with a simulated asynchronous store. Bounded controlled schedules and additional inputs, not a production or general correctness claim.",
    events,
  };
}
