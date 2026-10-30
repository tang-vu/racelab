import { DatabaseSync } from "node:sqlite";
import { executeClaim } from "./claim-runtime.mjs";

let database, input;
let busy = false;
process.on("message", async (message) => {
  if (busy) return;
  busy = true;
  try {
    if (message.command === "init") {
      input = message.input;
      database = new DatabaseSync(message.path, { timeout: 1500 });
      database.exec("PRAGMA busy_timeout=1500");
      process.send({ id: message.id, ready: true, pid: process.pid });
    } else if (message.command === "claim") {
      const trace = [];
      const claim = await executeClaim(
        database,
        { ...input, at: message.at },
        (event) => trace.push(event),
      );
      process.send({ id: message.id, claim, trace, pid: process.pid });
    } else if (message.command === "complete") {
      // Fixed processor boundary, outside the candidate. Completion is fenced by
      // the durable claim generation. This is a local receipt, never Discord.
      const before = database
        .prepare("SELECT * FROM follow_ups WHERE id=?")
        .get(message.jobId);
      const changed = database
        .prepare(
          "UPDATE follow_ups SET status='completed',completed_at=? WHERE id=? AND status='claimed' AND attempt_count=?",
        )
        .run(message.at, message.jobId, message.attempt);
      const after = database
        .prepare("SELECT * FROM follow_ups WHERE id=?")
        .get(message.jobId);
      process.send({
        id: message.id,
        completed: changed.changes === 1,
        before,
        after,
        pid: process.pid,
      });
    } else throw new Error("Unknown worker operation.");
  } catch (error) {
    process.send?.({
      id: message.id,
      error: String(error?.message ?? error).slice(0, 400),
      pid: process.pid,
    });
  } finally {
    busy = false;
  }
});
process.on("disconnect", () => {
  try {
    database?.close();
  } finally {
    process.exit(0);
  }
});
