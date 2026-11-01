import { readFile, writeFile } from "node:fs/promises";
import { readConfig } from "../src/config.mjs";
import { openLedger } from "../src/budget.mjs";
const path = new URL(
    "../public/recordings/comparison-study.json",
    import.meta.url,
  ),
  record = JSON.parse(await readFile(path));
if (
  record.status !== "stopped-error" ||
  record.requests !== 3 ||
  !record.error?.includes("HTTP 400")
)
  throw Error("This review applies only to the retained failed study.");
const ledger = await openLedger(readConfig()),
  state = await ledger.read(),
  entries = state.entries.filter((e) => e.status === "uncertain" && !e.review);
if (entries.length !== 1)
  throw Error("Unexpected unresolved accounting; no review was made.");
const entry = entries[0];
if (
  entry.createdAt < record.createdAt ||
  entry.createdAt > record.finishedAt ||
  entry.chargedMicros !== entry.reservedMicros
)
  throw Error("Charge does not match the retained study.");
const reason =
  "The retained study stopped at HTTP 400. No token usage or actual billing is known. Explicitly accept the ENTIRE reserved maximum as spent, preserve the uncertain entry/debit, and count it against the unchanged phase/total/reserve caps. This review does not assume a refund or zero billing. A separately committed amended experiment is needed; the failed study will not be overwritten or retried.";
const result = await ledger.acceptConservativeDebit(entry.id, reason);
await writeFile(
  new URL(
    "../public/recordings/comparison-accounting-review.json",
    import.meta.url,
  ),
  JSON.stringify(
    {
      version: 1,
      reviewedAt: new Date().toISOString(),
      reason,
      ...result,
      knownUsageCostUsd: record.attempts
        .flatMap((a) => a.calls)
        .reduce((n, c) => n + (c.costUsd ?? 0), 0),
      originalStudyRequests: record.requests,
      originalStudyConservativeDebitUsd: record.costUsd,
      originalEntriesDeleted: 0,
      originalDebitsReducedUsd: 0,
    },
    null,
    2,
  ) + "\n",
  { flag: "wx" },
);
console.log(
  JSON.stringify({
    conservativeDebitPreservedUsd: result.conservativeDebitUsd,
    blocked: result.blocked,
    deletedEntries: 0,
    reducedDebits: 0,
  }),
);
