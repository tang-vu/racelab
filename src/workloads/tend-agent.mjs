import { randomUUID } from "node:crypto";
import { CONDITIONS, runTend, verifyTend } from "./tend-engine.mjs";
import { TEND, sourceHash, compileClaim } from "./tend-source.mjs";

const object = (properties) => ({
  type: "object",
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});
const tools = [
  {
    type: "function",
    function: {
      name: "probe_recovery",
      description:
        "Execute the unchanged input under one controlled condition. Observe committed SQLite, real process exits and an independent contract before proposing a patch.",
      strict: true,
      parameters: object({
        hypothesis: { type: "string" },
        condition: { type: "string", enum: CONDITIONS.map((item) => item.id) },
      }),
    },
  },
  {
    type: "function",
    function: {
      name: "test_claim_patch",
      description:
        "Test a replacement TypeScript claimNextDue method against all ten fixed conditions. You cannot edit the harness, completion guard or acceptance contract. At most two proposals.",
      strict: true,
      parameters: object({
        explanation: { type: "string" },
        source: { type: "string" },
      }),
    },
  },
];
const compact = (run) => ({
  condition: run.condition,
  status: run.status,
  error: run.error,
  verdict: run.verdict,
  final: run.state,
  receipts: run.receipts,
  trace: run.trace.filter((event) =>
    ["claim-result", "process-killed", "completion"].includes(event.kind),
  ),
});

export async function investigateTend(
  client,
  bundle,
  source = bundle.source,
  emit = () => {},
) {
  compileClaim(source);
  const record = {
    version: 1,
    kind: TEND.id,
    engine: TEND.adapter,
    runId: randomUUID(),
    createdAt: new Date().toISOString(),
    input: {
      repository: TEND.repository,
      commit: TEND.commit,
      path: TEND.path,
      blobSha: TEND.blobSha,
      sourceUrl: bundle.sourceUrl,
      originalSourceHash: bundle.sourceHash,
    },
    startingSource: source,
    startingSourceHash: sourceHash(source),
    editedInput: source !== bundle.source,
    model: "muse-spark-1.3",
    baseline: null,
    probes: [],
    patches: [],
    events: [],
    turns: [],
    requests: 0,
    costUsd: 0,
    best: null,
    outcome: "incomplete",
    scope:
      "One retained investigation, up to two patches. Ten authored process/clock conditions on a pinned repository method and real temporary SQLite. Fixed local completion guard is RaceLab instrumentation, not a repair to the full TEND worker.",
  };
  const publish = (event) => {
    const item = { ...event, sequence: record.events.length + 1 };
    record.events.push(item);
    emit(item);
  };
  record.baseline = await runTend(bundle, source, "normal");
  publish({
    type: "baseline",
    message: "Uninterrupted execution checked against SQLite.",
    run: record.baseline,
  });
  const messages = [
    {
      role: "system",
      content: `You are RaceLab's repository-workload repair agent. Use executed experiments, then submit actual TypeScript. This input is a pinned method from ${TEND.repository}, revision ${TEND.commit}, ${TEND.path}. Only claimNextDue is in scope; the full TEND application is NOT loaded.
Execution: Node strips the method's TypeScript annotations, QuickJS executes it without Node capabilities, and a bounded synchronous database.prepare(...).get/all/run and database.transaction(fn) bridge talks to real disposable SQLite. Clock is controlled. No imports, network, filesystem, timers or arbitrary repository execution. followUpFromRow(row) is the unchanged pinned mapper with an adapter enforcing its essential row shape. 24 SQL statements per invocation, bounded guest CPU/memory. SQL exposes SELECT/UPDATE only on follow_ups. Do not add another class, constructor, import, helper module or external dependency. Return the entire replacement claimNextDue method, with the same public signature and return shape.
RECOVERY CONTRACT, fixed outside your code: a scheduled/retrying job is eligible when due_at <= now. A claimed job becomes eligible when it is due AND its non-null claimed_at <= now minus ${TEND.leaseMs} ms (including equality). Never claim a fresh live lease, completed job, or future job. Only status, claimed_at and attempt_count on the selected eligible row may change. Status must become claimed, claimed_at must equal the supplied clock, and attempt_count must increment exactly once. Return the matching job and persisted generation. Preserve payloads, deadlines, unrelated jobs and the transaction boundary. IDs and dates are not constants. Existing TEND did not define this lease expiry: it is the explicitly added lab contract.
The processor's fixture completion is outside your method. It commits only for the currently claimed attempt_count. After another process recovers a claim, its previous generation must no longer complete. No Discord, real delivery or production claim. Ten declared cases include normal execution, hard process exit after a commit, restart, a still-live old process, fresh lease protection, exact expiry, retry, future/completed rows, unrelated jobs and different inputs. Do not change tests or merely hide jobs.
INPUT METHOD:\n${source}
NORMAL EXECUTION:\n${JSON.stringify(compact(record.baseline))}
First call probe_recovery with a public hypothesis. At most 3 probes, 2 patch proposals, 6 model turns. Inspect failure feedback and revise if needed. Keep conclusions to the executed finite conditions; no universal correctness, production incident or new algorithm claims.`,
    },
    {
      role: "user",
      content:
        "Reproduce the lost claim across process interruption, repair the method, and test that recovery preserves exclusive ownership. Keep failures as evidence.",
    },
  ];
  let attempts = 0;
  for (let turn = 0; turn < 6; turn++) {
    publish({
      type: "model",
      message: `Muse Spark is investigating the repository method · ${turn + 1}/6`,
    });
    record.requests++;
    let response;
    try {
      response = await client.chat(messages, {
        maxOutput: 3000,
        tools: { tools, parallel_tool_calls: false },
      });
    } catch (error) {
      publish({ type: "error", message: error.message });
      record.error = error.message;
      break;
    }
    record.costUsd += response.costUsd ?? 0;
    const message = response.message,
      calls = message.tool_calls ?? [];
    // Retain visible output and proposals even when validation rejects a tool.
    record.turns.push({
      turn: turn + 1,
      message,
      costUsd: response.costUsd ?? 0,
    });
    if (!calls.length) {
      record.summary =
        typeof message.content === "string"
          ? message.content.slice(0, 2400)
          : "";
      break;
    }
    if (calls.length > 2) {
      record.error = "The model exceeded the per-turn tool limit.";
      publish({ type: "error", message: record.error });
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
        if (call.function.name === "probe_recovery") {
          if (record.probes.length >= 3)
            throw new Error("Three-probe cap reached.");
          if (typeof args.hypothesis !== "string")
            throw new Error("A public hypothesis is required.");
          const run = await runTend(bundle, source, args.condition);
          const probe = { hypothesis: args.hypothesis.slice(0, 1200), run };
          record.probes.push(probe);
          publish({ type: "probe", message: probe.hypothesis, probe });
          observation = compact(run);
        } else if (call.function.name === "test_claim_patch") {
          if (!record.probes.length)
            throw new Error(
              "Probe the unchanged input before proposing a patch.",
            );
          if (
            !record.probes.some(
              (item) =>
                item.run.status === "completed" && !item.run.verdict.passed,
            )
          )
            throw new Error(
              "Reproduce a completed original-input contract failure before proposing a patch.",
            );
          if (attempts++ >= 2) throw new Error("Two-patch cap reached.");
          compileClaim(args.source);
          if (args.source === source)
            throw new Error("The proposed source is unchanged.");
          publish({
            type: "checking",
            message:
              "Executing the proposed method across ten independent SQLite conditions…",
          });
          const verification = await verifyTend(bundle, args.source);
          const patch = {
            source: args.source,
            sourceHash: sourceHash(args.source),
            explanation: String(args.explanation ?? "").slice(0, 1600),
            verification,
          };
          record.patches.push(patch);
          publish({ type: "patch", message: patch.explanation, patch });
          observation = {
            passed: verification.passed,
            tested: verification.tested,
            scope: verification.scope,
            cases: verification.cases.map((item) => ({
              condition: item.id,
              passed: item.passed,
              ...(!item.passed ? { failure: compact(item.run) } : {}),
            })),
          };
        } else throw new Error("Unknown repository workload tool.");
      } catch (error) {
        observation = { error: String(error?.message ?? error).slice(0, 500) };
        publish({ type: "rejected", message: observation.error });
      }
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(observation),
      });
    }
    if (record.patches.at(-1)?.verification.passed) break;
  }
  record.best =
    record.patches.find((patch) => patch.verification.passed) ??
    record.patches.at(-1) ??
    null;
  record.outcome = record.best?.verification.passed
    ? "repaired_in_checked_conditions"
    : record.patches.length
      ? "not_repaired_in_checked_conditions"
      : "incomplete";
  return record;
}

export async function replayTend(record, bundle, trusted = false) {
  if (
    !record ||
    record.version !== 1 ||
    record.kind !== TEND.id ||
    record.engine !== TEND.adapter
  )
    throw new Error("Unsupported repository-workload report.");
  if (
    record.input?.commit !== TEND.commit ||
    record.input?.blobSha !== TEND.blobSha ||
    record.input?.originalSourceHash !== bundle.sourceHash
  )
    throw new Error(
      "The report does not match the verified pinned repository input.",
    );
  compileClaim(record.startingSource);
  if (sourceHash(record.startingSource) !== record.startingSourceHash)
    throw new Error("The report's starting source hash does not match.");
  if (
    !Array.isArray(record.probes) ||
    record.probes.length > 3 ||
    !Array.isArray(record.patches) ||
    record.patches.length > 2
  )
    throw new Error("Report exceeds the bounded investigation limits.");
  const baseline = await runTend(bundle, record.startingSource, "normal"),
    probes = [],
    patches = [];
  for (const probe of record.probes)
    probes.push({
      hypothesis: String(probe.hypothesis ?? "").slice(0, 1200),
      run: await runTend(bundle, record.startingSource, probe.run?.condition),
    });
  for (const patch of record.patches) {
    compileClaim(patch.source);
    patches.push({
      source: patch.source,
      sourceHash: sourceHash(patch.source),
      explanation: String(patch.explanation ?? "").slice(0, 1600),
      verification: await verifyTend(bundle, patch.source),
    });
  }
  const best =
    patches.find((patch) => patch.verification.passed) ??
    patches.at(-1) ??
    null;
  return {
    version: 1,
    kind: TEND.id,
    engine: TEND.adapter,
    runId: record.runId,
    createdAt: record.createdAt,
    input: { ...record.input, sourceUrl: bundle.sourceUrl },
    startingSource: record.startingSource,
    startingSourceHash: record.startingSourceHash,
    editedInput: record.startingSource !== bundle.source,
    model: trusted
      ? record.model
      : "Imported candidate / attribution unverified",
    baseline,
    probes,
    patches,
    best,
    outcome: best?.verification.passed
      ? "repaired_in_checked_conditions"
      : "not_repaired_in_checked_conditions",
    requests: 0,
    costUsd: 0,
    recomputed: true,
    recordedRequests: trusted ? record.requests : undefined,
    recordedCostUsd: trusted ? record.costUsd : undefined,
    scope:
      "All imported verdicts, traces and process receipts were discarded and recomputed locally. Ten controlled conditions; fixed local completion guard is adapter instrumentation, not full TEND integration.",
  };
}
