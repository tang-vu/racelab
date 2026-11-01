import { readFile, writeFile } from "node:fs/promises";
const root = new URL("../", import.meta.url),
  read = async (name) => JSON.parse(await readFile(new URL(name, root)));
const original = await read("public/recordings/comparison-study.json"),
  study = await read("public/recordings/comparison-study-v2.json"),
  protocol = await read("demo/comparison-protocol-v2.json"),
  review = await read("public/recordings/comparison-accounting-review.json");
const planned = protocol.order.flatMap((pair) =>
  pair.arms.map((arm) => {
    const id = `${pair.task}-${pair.repetition}-${arm}`,
      a = study.attempts.find((a) => a.id === id);
    return {
      id,
      task: pair.task,
      repetition: pair.repetition,
      arm,
      status: a?.status ?? "not-run-after-stop",
      heldOutPassed: a?.heldOut?.passed ?? null,
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
    complete: arms.every((a) => a.status === "completed"),
    arms,
  };
});
const knownOriginal = original.attempts
  .flatMap((a) => a.calls)
  .reduce((n, c) => n + (c.costUsd ?? 0), 0);
const report = {
  version: 1,
  createdAt: new Date().toISOString(),
  status: "incomplete-predeclared-study",
  originalStatus: original.status,
  amendedStatus: study.status,
  protocolCommit: study.protocolCommit,
  plannedArms: planned.length,
  completedArms: planned.filter((a) => a.status === "completed").length,
  failedArms: planned.filter((a) => a.status === "error").length,
  notRunArms: planned.filter((a) => a.status === "not-run-after-stop").length,
  planned,
  paired,
  requests: {
    original: original.requests,
    amended: study.requests,
    total: original.requests + study.requests,
  },
  cost: {
    originalKnownUsageUsd: knownOriginal,
    amendedKnownUsageLedgerUsd: study.costUsd,
    originalUnknownChargeConservativeDebitUsd: review.conservativeDebitUsd,
    totalConservativeLedgerDebitUsd: Number(
      (original.costUsd + study.costUsd).toFixed(6),
    ),
    note: "Per-request costs can differ from rounded ledger debits. The truncated request returned token usage settled in the ledger, but transport rejected its output and did not retain its content/usage in the public call record. Amended study aggregate includes that known debit. The original HTTP 400 charge is unknown and remains fully debited conservatively; this is not provider billing verification.",
  },
  conclusion:
    "Only two complete paired repetitions of the TEND claim task finished: direct and feedback each passed 6/6 held-out conditions in both repetitions. This sample shows no pass-count advantage. The first lifecycle direct attempt hit the output token cap; the frozen runner stopped. Remaining planned arms were not run. No aggregate three-task repair rate, lifecycle AI repair result or general AI advantage is established. The original failed setup is reported separately, not pooled or overwritten.",
  limitations: [
    "Small purposive sample; two TEND tasks share source.",
    "Held-out means withheld from prompts/feedback, not novel problem classes or training-data isolation.",
    "Original failed setup includes incompatible source boundaries and API HTTP 400; cause of HTTP 400 not diagnosed.",
    "Model output truncation is retained as a failure; the client did not retain truncated message content.",
    "No human usability or productivity measurements. No external delivery guarantee.",
  ],
};
if (process.argv.includes("--record"))
  await writeFile(
    new URL("public/recordings/comparison-summary.json", root),
    JSON.stringify(report, null, 2) + "\n",
    { flag: "wx" },
  );
console.log(JSON.stringify(report, null, 2));
