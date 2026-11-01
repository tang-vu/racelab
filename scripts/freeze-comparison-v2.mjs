import { readFile, writeFile } from "node:fs/promises";
import { sourceHash } from "../src/workloads/tend-source.mjs";
const root = new URL("../", import.meta.url),
  original = await readFile(new URL("demo/comparison-protocol.json", root)),
  p = JSON.parse(original);
p.version = 2;
p.id = "racelab-bounded-comparison-amended-20261101";
p.frozenAt = new Date().toISOString();
p.originalProtocolHash = sourceHash(original);
p.originalStudyHash = sourceHash(
  await readFile(new URL("public/recordings/comparison-study.json", root)),
);
p.amendments = [
  "Retain the original study as a failed setup/pilot, including an invalid class-shaped direct candidate and API HTTP 400. Do not pool or hide it.",
  "Remove the forced function tool_choice field; use the same tools plus parallel_tool_calls:false shape already used by the original successful TEND investigation. The reason for HTTP 400 is not known from a returned body; this is a compatibility change, not a proven root-cause diagnosis.",
  "Specify exact source boundaries (method-only TEND; three method declarations for lifecycle; diffSync function for airules) identically for both arms. Existing evaluators, cases, source, contracts and splits are unchanged.",
  "Conduct the entire two-repetition comparison under this amended protocol, not a replacement of selected losing attempts. Stop on any further API error; no further automatic amendments.",
  "Explicitly accept the old uncertain charge at the full reservation debit with no reduction or deleted entries. Actual failed-request billing remains unknown. V2 cap is $3 incremental including conservative reservations, within the existing $10 phase cap; combined retained study debit cannot exceed $4.5.",
];
p.combinedStudyCapUsd = 4.5;
for (const file of [
  "scripts/run-comparison-v2.mjs",
  "src/meta.mjs",
  "src/budget.mjs",
])
  p.files[file] = sourceHash(await readFile(new URL(file, root)));
await writeFile(
  new URL("demo/comparison-protocol-v2.json", root),
  JSON.stringify(p, null, 2) + "\n",
  { flag: "wx" },
);
console.log("Amended protocol frozen. Commit before any amended study calls.");
