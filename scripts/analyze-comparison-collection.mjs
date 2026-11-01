import { readFile, writeFile } from "node:fs/promises";
const root = new URL("../", import.meta.url),
  bytes = (path) => readFile(new URL(path, root)),
  read = async (path) => JSON.parse(await bytes(path));
const [original, study, continued, protocol, review] = await Promise.all([
  read("public/recordings/comparison-study.json"),
  read("public/recordings/comparison-study-v2.json"),
  read("public/recordings/comparison-continuation.json"),
  read("demo/comparison-protocol-v2.json"),
  read("public/recordings/comparison-accounting-review.json"),
]);
if (continued.status !== "completed")
  throw Error(
    "Continuation is not complete; do not publish a full collection.",
  );
const attempts = [...study.attempts, ...continued.attempts];
if (new Set(attempts.map((a) => a.id)).size !== attempts.length)
  throw Error("A prior attempt was repeated; do not pool it.");
const planned = protocol.order.flatMap((pair) =>
  pair.arms.map((arm) => {
    const id = `${pair.task}-${pair.repetition}-${arm}`,
      a = attempts.find((a) => a.id === id);
    return {
      id,
      task: pair.task,
      repetition: pair.repetition,
      arm,
      collection: continued.attempts.some((a) => a.id === id)
        ? "post-hoc-continuation"
        : "amended-study",
      status: a?.status ?? "not-run",
      heldOutPassed: a?.heldOut?.passed ?? false,
      heldOutConditionsPassed:
        a?.heldOut?.cases.filter((c) => c.passed).length ?? null,
      heldOutConditionsTested: a?.heldOut?.tested ?? null,
      error: a?.error ?? null,
    };
  }),
);
const paired = protocol.order.map((p) => {
  const arms = planned.filter(
    (a) => a.task === p.task && a.repetition === p.repetition,
  );
  return {
    task: p.task,
    repetition: p.repetition,
    collected: arms.every((a) => a.status !== "not-run"),
    completeFinalCandidates: arms.every((a) => a.status === "completed"),
    arms,
  };
});
const armCounts = Object.fromEntries(
  ["direct", "feedback"].map((arm) => {
    const rows = planned.filter((a) => a.arm === arm);
    return [
      arm,
      {
        planned: rows.length,
        attempted: rows.filter((a) => a.status !== "not-run").length,
        heldOutPasses: rows.filter((a) => a.heldOutPassed).length,
        outputErrors: rows.filter((a) => a.status === "error").length,
      },
    ];
  }),
);
const report = {
  version: 2,
  createdAt: new Date().toISOString(),
  status: "all-planned-arms-attempted-with-post-hoc-continuation",
  originalStatus: original.status,
  amendedStatus: study.status,
  continuationStatus: continued.status,
  protocolCommit: study.protocolCommit,
  continuationProtocolCommit: continued.protocolCommit,
  plannedArms: planned.length,
  completedArms: planned.filter((a) => a.status === "completed").length,
  failedArms: planned.filter((a) => a.status === "error").length,
  notRunArms: planned.filter((a) => a.status === "not-run").length,
  planned,
  paired,
  armCounts,
  requests: {
    original: original.requests,
    amended: study.requests,
    continuation: continued.requests,
    total: original.requests + study.requests + continued.requests,
  },
  cost: {
    originalKnownUsageUsd: original.attempts
      .flatMap((a) => a.calls)
      .reduce((n, c) => n + (c.costUsd ?? 0), 0),
    amendedKnownUsageLedgerUsd: study.costUsd,
    continuationKnownUsageLedgerUsd: continued.costUsd,
    originalUnknownChargeConservativeDebitUsd: review.conservativeDebitUsd,
    totalConservativeLedgerDebitUsd: Number(
      (original.costUsd + study.costUsd + continued.costUsd).toFixed(6),
    ),
    note: "All original debits remain. Truncated output returned settled usage but its content/usage was not retained in the public per-call row. Aggregate known ledger debit includes it. HTTP400 billing remains unknown and fully charged at the reservation maximum; this is not provider billing verification.",
  },
  conclusion: `All 12 originally planned amended-design arms were attempted exactly once: ${planned.filter((a) => a.status === "completed").length} returned final candidates, ${planned.filter((a) => a.status === "error").length} failed, ${planned.filter((a) => a.status === "not-run").length} unrun. Complete-arm held-out passes in this collection: direct ${armCounts.direct.heldOutPasses}/6, feedback ${armCounts.feedback.heldOutPasses}/6. Two paired claim repetitions passed 6/6 in both arms. The original amended runner stopped at a lifecycle output cap; its seven unrun arms were collected afterward under a separately frozen continuation. The failed lifecycle direct arm was never retried. This is a post-hoc deviation from global stopping, not an uninterrupted preregistered three-task benchmark or a general AI-superiority result.`,
  limitations: [
    "Two purposive repetitions per task; two TEND tasks share source.",
    "Seven arms were collected after observing the amended study stop. Original stopped artifacts stay unchanged and are disclosed separately.",
    "Different tasks have different held-out condition counts; do not compare raw condition totals as if equally weighted.",
    "Held-out means withheld from prompts/feedback, not novel classes or training-data isolation.",
    "Output-cap errors count as failed arms; unavailable truncated content is not reconstructed.",
    "No whole-application guarantee, human feedback or measured productivity gain.",
  ],
};
if (process.argv.includes("--record")) {
  const current = await bytes("public/recordings/comparison-summary.json"),
    preserved = await bytes(
      "public/recordings/comparison-summary-pre-continuation.json",
    );
  if (!current.equals(preserved))
    throw Error(
      "Original summary must be byte-preserved; a collection summary already exists.",
    );
  await writeFile(
    new URL("public/recordings/comparison-summary.json", root),
    JSON.stringify(report, null, 2) + "\n",
  );
}
console.log(
  JSON.stringify(
    {
      status: report.status,
      completed: report.completedArms,
      failed: report.failedArms,
      unrun: report.notRunArms,
      arms: armCounts,
      requests: report.requests,
      cost: report.cost,
    },
    null,
    2,
  ),
);
