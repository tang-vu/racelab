export function frameFor(run, index) {
  if (!run) return null;
  const step = Math.max(
    0,
    Math.min(run.trace.length, Math.round(Number(index) || 0)),
  );
  let rows = structuredClone(run.initial),
    receipts = 0;
  const processes = {};
  for (const event of run.trace.slice(0, step)) {
    if (Array.isArray(event.rows)) rows = event.rows;
    // SQL events include the connection's in-transaction state. Only a commit
    // or a later durable snapshot may advance the committed-memory display.
    else if (event.kind !== "sql" && Array.isArray(event.after))
      rows = event.after;
    else if (event.after?.id)
      rows = rows.map((row) => (row.id === event.after.id ? event.after : row));
    if (event.kind === "process-start")
      processes[event.actor] = {
        pid: event.pid,
        status: "running",
        claim: null,
      };
    if (event.kind === "process-killed")
      processes[event.actor] = {
        ...processes[event.actor],
        status: "terminated",
      };
    if (event.kind === "claim-result")
      processes[event.actor] = {
        ...processes[event.actor],
        claim: event.claim,
      };
    if (event.kind === "completion" && event.accepted) receipts++;
  }
  return {
    step,
    total: run.trace.length,
    rows,
    processes,
    receipts,
    final: step === run.trace.length,
    verdict:
      step === run.trace.length
        ? run.status !== "completed"
          ? "ERROR"
          : run.verdict.passed
            ? "PASS"
            : "FAIL"
        : "REPLAY",
    event: run.trace[step - 1] ?? null,
  };
}
export function eventText(event) {
  if (event.kind === "initial") return "Persist the fixture in SQLite";
  if (event.kind === "process-start")
    return `Start worker ${event.actor} · PID ${event.pid}`;
  if (event.kind === "process-killed")
    return `Stop worker ${event.actor} · ${event.signal ?? event.code} · exit observed`;
  if (event.kind === "transaction")
    return `${event.actor} · ${event.action.toUpperCase()} transaction`;
  if (event.kind === "sql")
    return `${event.actor} · ${event.method.toUpperCase()} · ${event.sql.trim().replace(/\s+/g, " ").slice(0, 95)}`;
  if (event.kind === "claim-result")
    return `${event.actor} · ${event.claim ? `claim ${event.claim.id}, generation ${event.claim.attemptCount}` : "no eligible job returned"}`;
  if (event.kind === "completion")
    return `${event.actor} · generation ${event.generation} completion ${event.accepted ? "accepted" : "rejected"}`;
  if (event.kind === "final") return "Read the final persisted state";
  return event.message ?? event.kind;
}
export function methodDiff(original, candidate) {
  const indent = (source) => {
    const lines = source.trimEnd().split("\n"),
      margin = Math.min(
        ...lines.filter((l) => l.trim()).map((l) => l.match(/^ */)[0].length),
      );
    return lines.map((line) => "  " + line.slice(margin));
  };
  const before = indent(original),
    after = indent(candidate);
  // Include real trailing context so ordinary `git apply` accepts the hunk.
  // The exported patch targets the verified pin, regardless of local A edits.
  return `--- a/packages/db/src/store.ts\n+++ b/packages/db/src/store.ts\n@@ -1017,${before.length + 2} +1017,${after.length + 2} @@\n${before.map((line) => "-" + line).join("\n")}\n${after.map((line) => "+" + line).join("\n")}\n \n   completeFollowUp(\n`;
}
