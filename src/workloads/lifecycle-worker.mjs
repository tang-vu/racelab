import { DatabaseSync } from "node:sqlite";
import { executeClaim } from "./claim-runtime.mjs";
let db,
  input,
  busy = false;
process.on("message", async (message) => {
  if (busy) return;
  busy = true;
  try {
    if (message.command === "init") {
      db = new DatabaseSync(message.path, { timeout: 1500 });
      db.exec("PRAGMA busy_timeout=1500");
      input = message.input;
      process.send({ id: message.id, ready: true, pid: process.pid });
    } else {
      const trace = [];
      const value = await executeClaim(
        db,
        {
          ...input,
          lifecycle: true,
          at: message.at,
          operation: message.command,
          args: message.args ?? [],
        },
        (event) => {
          trace.push(event);
          const pause =
            message.pauseAt === "before-commit"
              ? event.kind === "sql" && /^\s*UPDATE/i.test(event.sql)
              : message.pauseAt === "after-commit" &&
                event.kind === "transaction" &&
                event.action === "commit";
          if (pause) {
            process.send({
              id: message.id,
              barrier: message.pauseAt,
              trace,
              pid: process.pid,
            });
            // A real process remains inside the transaction (or after COMMIT)
            // until the parent observes this barrier and terminates it.
            Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 30000);
            throw new Error("Interruption barrier timed out.");
          }
        },
      );
      process.send({ id: message.id, value, trace, pid: process.pid });
    }
  } catch (e) {
    process.send?.({
      id: message.id,
      error: String(e.message ?? e).slice(0, 400),
      pid: process.pid,
    });
  } finally {
    busy = false;
  }
});
process.on("disconnect", () => {
  db?.close();
  process.exit(0);
});
