import { readFile, writeFile } from "node:fs/promises";
import { readConfig } from "../src/config.mjs";
import { sourceHash } from "../src/workloads/tend-source.mjs";
import { studyTasks } from "../src/study-tasks.mjs";
const files = [
  "src/study-tasks.mjs",
  "src/workloads/tend-engine.mjs",
  "src/workloads/tend-source.mjs",
  "src/workloads/claim-runtime.mjs",
  "src/workloads/claim-worker.mjs",
  "src/workloads/lifecycle-engine.mjs",
  "src/workloads/lifecycle-worker.mjs",
  "src/workloads/repository-engine.mjs",
  "scripts/run-comparison.mjs",
  "demo/repository-inputs.json",
];
const hashes = {};
for (const path of files)
  hashes[path] = sourceHash(
    await readFile(new URL("../" + path, import.meta.url)),
  );
const tasks = await studyTasks(readConfig().dataDirectory);
const protocol = {
  version: 1,
  id: "racelab-bounded-comparison-20261101",
  frozenAt: new Date().toISOString(),
  model: "muse-spark-1.3",
  reasoningEffort: "low",
  repetitions: 2,
  arms: ["direct", "feedback"],
  requestsPerArm: 2,
  maxOutputTokensPerRequest: 4096,
  maxOutputTokensPerArm: 8192,
  studyIncrementalCapUsd: 3,
  selection:
    "Use the second/final proposal only. Retain first proposals, rejections and failures; no best-of selection or retries. Stop the study on API/accounting errors; do not rerun it for a better result.",
  treatment:
    "Both arms receive identical source, contract and development-condition names. Direct: propose, then self-review with no executed feedback. Feedback: propose through test_candidate, receive only independent development checks, then revise. Same model, low reasoning, two request/output ceilings. Actual token usage, latency and cost may differ; these are resource ceilings, not equal spend or a production benchmark.",
  heldOutPolicy:
    "Held-out fixtures and results are withheld from prompts and tool feedback; evaluate only the final proposal. Public preexisting TEND conditions are not novel problem classes. Developers can inspect frozen evaluators; no claim of training-data isolation. Small purposive sample, two repetitions, no significance or general superiority claim.",
  scope:
    "Two TEND adapters share source and are correlated tasks. airules edit-count precision is a RaceLab-added contract. OpenMusic is a separately retained healthy code control, not an AI repair task or human study.",
  tasks: tasks.map(({ id, sourceHash, contract, development, heldOut }) => ({
    id,
    sourceHash,
    contract,
    development,
    heldOut,
  })),
  order: tasks.flatMap((t) => [
    { task: t.id, repetition: 1, arms: ["direct", "feedback"] },
    { task: t.id, repetition: 2, arms: ["feedback", "direct"] },
  ]),
  files: hashes,
};
await writeFile(
  new URL("../demo/comparison-protocol.json", import.meta.url),
  JSON.stringify(protocol, null, 2) + "\n",
  { flag: "wx" },
);
console.log(
  "Protocol frozen locally. Commit the protocol and evaluator files before --live.",
);
