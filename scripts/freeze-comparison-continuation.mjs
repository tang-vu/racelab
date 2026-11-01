import { readFile, writeFile } from "node:fs/promises";
import { sourceHash } from "../src/workloads/tend-source.mjs";
const root = new URL("../", import.meta.url),
  read = (path) => readFile(new URL(path, root));
const previous = await read("demo/comparison-protocol-v2.json"),
  studyBytes = await read("public/recordings/comparison-study-v2.json"),
  study = JSON.parse(studyBytes),
  protocol = JSON.parse(previous);
const attempted = new Set(study.attempts.map((a) => a.id));
const order = protocol.order
  .map((pair) => ({
    ...pair,
    arms: pair.arms.filter(
      (arm) => !attempted.has(`${pair.task}-${pair.repetition}-${arm}`),
    ),
  }))
  .filter((pair) => pair.arms.length);
if (order.reduce((n, p) => n + p.arms.length, 0) !== 7)
  throw Error("Expected exactly the seven previously unrun arms, not retries.");
protocol.version = 3;
protocol.id = "racelab-previously-unrun-continuation-20261101";
protocol.frozenAt = new Date().toISOString();
protocol.parentProtocolHash = sourceHash(previous);
protocol.parentStoppedStudyHash = sourceHash(studyBytes);
protocol.order = order;
protocol.selection =
  "Run only the seven previously unrun planned arms. Never rerun any completed, failed, truncated or rejected old attempt. Each first-time arm retains at most two requests,4096 output tokens per request. Known settled output truncation/schema failure counts as a failed arm with no retry; proceed to the next previously unrun arm. Any HTTP/transport/uncertain-accounting error stops the entire continuation. Preserve stopped original studies unchanged.";
protocol.continuationDisclosure =
  "Post-hoc continuation and a deviation from the original runner's global-stop policy, explicitly declared after seeing the earlier stop. The first two studies remain stopped/incomplete. Do not present a pooled collection as an uninterrupted preregistered benchmark. Sources, contracts, prompts, evaluator cases, held-out splits, model, reasoning and per-arm ceilings remain the same. Missing truncated content cannot be reconstructed. Original failed lifecycle direct arm remains a failure; it is excluded from the seven new arms, not replaced.";
protocol.studyIncrementalCapUsd = 3;
protocol.combinedStudyCapUsd = 4.5;
protocol.priorCombinedConservativeDebitUsd = Number(
  (
    JSON.parse(await read("public/recordings/comparison-study.json")).costUsd +
    study.costUsd
  ).toFixed(6),
);
protocol.files["scripts/run-comparison-continuation.mjs"] = sourceHash(
  await read("scripts/run-comparison-continuation.mjs"),
);
await writeFile(
  new URL("demo/comparison-continuation-protocol.json", root),
  JSON.stringify(protocol, null, 2) + "\n",
  { flag: "wx" },
);
console.log(
  "Frozen: exactly seven first-time arms, zero old attempts rerun. Commit before paid calls.",
);
