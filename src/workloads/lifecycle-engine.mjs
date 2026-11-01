import { fork } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { compileLifecycle, sourceHash } from "./tend-source.mjs";

export const LIFECYCLE_CONTRACT = `RaceLab lifecycle adapter v2, not upstream completeFollowUp. claimNextDue(now) returns a mapped job or null; due scheduled/retrying jobs and claimed jobs with claimed_at <= now-60000 are eligible. Increment attempt_count exactly once on each acquisition. renewClaim(id,generation,now) and completeClaim(id,generation,now) return boolean; only a currently claimed matching generation with claimed_at > now-60000 may renew or complete. Renewal sets claimed_at=now without changing generation. Completion sets status=completed, completed_at=now. At expiry (inclusive), old tokens cannot renew or complete. Preserve payload, due_at and unrelated/future/completed jobs. All writes must be transactional. Concurrent SQLite BUSY is allowed only with a bounded harness retry, never two successful owners. Methods use this.database.prepare(...).get/all/run and this.database.transaction(fn)(); no network/files/imports. Local completion is a database transition only, no external side effect.`;
export const LIFECYCLE_CASES = [
  { id: "normal", split: "development" },
  { id: "recovery", split: "development" },
  { id: "stale", split: "development" },
  { id: "renew", split: "development" },
  { id: "competing", split: "held-out" },
  { id: "before-commit", split: "held-out" },
  { id: "after-commit", split: "held-out" },
  { id: "expired-renew", split: "held-out" },
  { id: "renew-boundary", split: "held-out" },
  { id: "different-input", split: "held-out" },
];
export function lifecycleBaseline(bundle) {
  return `${bundle.source}\n\n// RaceLab-authored unfenced lifecycle baseline, not TEND completeFollowUp.\nrenewClaim(id, generation, now = new Date()) { return false; }\ncompleteClaim(id, generation, now = new Date()) { return this.database.transaction(() => this.database.prepare("UPDATE follow_ups SET status='completed', completed_at=? WHERE id=? AND status='claimed'").run(now.toISOString(), id).changes === 1)(); }`;
}
export function lifecycleControl(claim) {
  const method = (name, update) =>
    `${name}(id, generation, now = new Date()) { const timestamp=now.toISOString(), cutoff=new Date(now.getTime()-60000).toISOString(); return this.database.transaction(() => this.database.prepare("${update} WHERE id=? AND status='claimed' AND attempt_count=? AND claimed_at>?").run(timestamp,id,generation,cutoff).changes===1)(); }`;
  return `${claim}\n${method("renewClaim", "UPDATE follow_ups SET claimed_at=?")}\n${method("completeClaim", "UPDATE follow_ups SET status='completed', completed_at=?")}`;
}
function worker(path, input, label) {
  const child = fork(new URL("./lifecycle-worker.mjs", import.meta.url), [], {
    env: {},
    execArgv: [],
    windowsHide: true,
    stdio: ["ignore", "ignore", "ignore", "ipc"],
  });
  let sequence = 0,
    ended = false;
  const pending = new Map();
  const exited = new Promise((done) =>
    child.once("exit", (code, signal) => {
      ended = true;
      for (const p of pending.values()) {
        clearTimeout(p.timer);
        p.reject(new Error("Worker exited before result."));
      }
      pending.clear();
      done({ pid: child.pid, code, signal });
    }),
  );
  child.on("error", () => {
    for (const p of pending.values()) {
      clearTimeout(p.timer);
      p.reject(new Error("Worker failed."));
    }
    pending.clear();
  });
  child.on("message", (m) => {
    const p = pending.get(m.id);
    if (!p) return;
    pending.delete(m.id);
    clearTimeout(p.timer);
    m.error ? p.reject(new Error(m.error)) : p.resolve(m);
  });
  const call = (m) =>
    new Promise((resolve, reject) => {
      if (ended) return reject(new Error("Worker exited."));
      const id = ++sequence,
        timer = setTimeout(() => {
          pending.delete(id);
          child.kill();
          reject(new Error("Worker exceeded eight seconds."));
        }, 8000);
      pending.set(id, { resolve, reject, timer });
      child.send({ ...m, id }, (e) => {
        if (e) {
          clearTimeout(timer);
          pending.delete(id);
          reject(new Error("Worker IPC failed."));
        }
      });
    });
  return {
    label,
    pid: child.pid,
    call,
    ready: call({ command: "init", path, input }),
    async stop(hard = false) {
      if (!ended) {
        if (hard) child.kill();
        else child.disconnect();
      }
      return exited;
    },
  };
}
export async function runLifecycle(bundle, source, conditionId) {
  compileLifecycle(source);
  if (!LIFECYCLE_CASES.some((c) => c.id === conditionId))
    throw new Error("Unknown lifecycle condition.");
  const directory = await mkdtemp(join(tmpdir(), "racelab-lifecycle-")),
    path = join(directory, "jobs.sqlite"),
    actors = [],
    trace = [],
    checks = [];
  const now =
      conditionId === "different-input"
        ? "2028-02-03T05:00:00.000Z"
        : "2026-11-01T12:00:00.000Z",
    id = conditionId === "different-input" ? "copper-71" : "blue",
    generation = conditionId === "different-input" ? 17 : 0;
  const at = (seconds) =>
    new Date(Date.parse(now) + seconds * 1000).toISOString();
  let status = "completed",
    error = null;
  const check = (name, actual, expected) =>
    checks.push({
      name,
      passed: JSON.stringify(actual) === JSON.stringify(expected),
      actual,
      expected,
    });
  const db = new DatabaseSync(path);
  db.exec(
    "PRAGMA journal_mode=WAL; CREATE TABLE follow_ups(id TEXT PRIMARY KEY,incident_id TEXT,due_at TEXT,purpose TEXT,status TEXT,attempt_count INTEGER,last_error TEXT,idempotency_key TEXT,claimed_at TEXT,created_at TEXT,completed_at TEXT)",
  );
  const insert = db.prepare(
    "INSERT INTO follow_ups VALUES(?,?,?,?,?,?,?,?,?,?,?)",
  );
  const row = [
    id,
    "fixture",
    at(-10),
    "LOCAL ONLY",
    "scheduled",
    generation,
    null,
    "key-" + id,
    null,
    at(-100),
    null,
  ];
  insert.run(...row);
  insert.run(
    "future",
    "fixture",
    at(10000),
    "KEEP",
    "scheduled",
    0,
    null,
    "future",
    null,
    at(-100),
    null,
  );
  db.close();
  const snapshot = () => {
    const d = new DatabaseSync(path, { readOnly: true });
    try {
      return d
        .prepare("SELECT * FROM follow_ups ORDER BY id")
        .all()
        .map((r) => ({ ...r }));
    } finally {
      d.close();
    }
  };
  const initial = snapshot();
  const start = async (label) => {
    const w = worker(path, { source, rowAdapter: bundle.rowAdapter }, label);
    actors.push(w);
    await w.ready;
    trace.push({ kind: "process-start", actor: label, pid: w.pid });
    return w;
  };
  const call = async (w, command, seconds, args = [], pauseAt) => {
    const r = await w.call({ command, at: at(seconds), args, pauseAt });
    trace.push(...(r.trace ?? []).map((e) => ({ ...e, actor: w.label })), {
      kind: r.barrier ? "barrier" : "result",
      actor: w.label,
      command,
      at: at(seconds),
      value: r.value ?? null,
      barrier: r.barrier,
    });
    return r;
  };
  try {
    const a = await start("A");
    if (conditionId === "competing") {
      const b = await start("B");
      const attempts = await Promise.allSettled([
        call(a, "claimNextDue", 0),
        call(b, "claimNextDue", 0),
      ]);
      const claims = attempts
        .filter((r) => r.status === "fulfilled" && r.value.value)
        .map((r) => r.value.value);
      check("One simultaneous claimant wins", claims.length, 1);
      for (let n = 0; n < attempts.length; n++)
        if (attempts[n].status === "rejected") {
          const message = attempts[n].reason.message;
          trace.push({
            kind: "contention",
            actor: n ? "B" : "A",
            error: message,
          });
          check(
            "Contention error is SQLite BUSY",
            /locked|busy/i.test(message),
            true,
          );
          const retry = await call(n ? b : a, "claimNextDue", 1);
          check(
            "Bounded losing-worker retry returns no claim",
            retry.value,
            null,
          );
        }
      const winner = claims[0];
      if (winner) {
        const owner =
          attempts[0].status === "fulfilled" && attempts[0].value.value ? a : b;
        check(
          "Winning generation completes",
          (await call(owner, "completeClaim", 2, [id, winner.attemptCount]))
            .value,
          true,
        );
      }
    } else if (
      conditionId === "before-commit" ||
      conditionId === "after-commit"
    ) {
      const result = await call(a, "claimNextDue", 0, [], conditionId);
      check("Interruption barrier observed", result.barrier, conditionId);
      const receipt = await a.stop(true);
      trace.push({ kind: "process-killed", actor: "A", ...receipt });
      check("Exit observed before restart", Boolean(receipt.pid), true);
      const stored = snapshot().find((r) => r.id === id);
      check(
        "Durable generation at interruption",
        stored.attempt_count,
        generation + (conditionId === "after-commit" ? 1 : 0),
      );
      check(
        "Durable status at interruption",
        stored.status,
        conditionId === "after-commit" ? "claimed" : "scheduled",
      );
      const b = await start("B"),
        seconds = conditionId === "after-commit" ? 61 : 1;
      const claim = (await call(b, "claimNextDue", seconds)).value;
      check("Restart recovers eligible job", claim?.id ?? null, id);
      if (claim)
        check(
          "Recovered token completes",
          (
            await call(b, "completeClaim", seconds + 1, [
              id,
              claim.attemptCount,
            ])
          ).value,
          true,
        );
    } else {
      const claim = (await call(a, "claimNextDue", 0)).value;
      check("Initial job acquired", claim?.id ?? null, id);
      check(
        "Acquisition generation",
        claim?.attemptCount ?? null,
        generation + 1,
      );
      if (!claim) throw new Error("No initial claim.");
      const token = [id, claim.attemptCount];
      if (["normal"].includes(conditionId))
        check(
          "Current owner completes",
          (await call(a, "completeClaim", 1, token)).value,
          true,
        );
      else if (["renew", "renew-boundary"].includes(conditionId)) {
        check(
          "Active owner renews",
          (await call(a, "renewClaim", 40, token)).value,
          true,
        );
        const b = await start("B"),
          boundary = conditionId === "renew-boundary";
        check(
          "Renewed lease protects long job",
          (await call(b, "claimNextDue", boundary ? 99 : 70)).value,
          null,
        );
        if (boundary) {
          const recovered = (await call(b, "claimNextDue", 100)).value;
          check(
            "Renewed lease expires inclusively",
            recovered?.attemptCount ?? null,
            generation + 2,
          );
          check(
            "Old token cannot complete after renewed expiry",
            (await call(a, "completeClaim", 101, token)).value,
            false,
          );
          if (recovered)
            check(
              "New token completes",
              (
                await call(b, "completeClaim", 101, [
                  id,
                  recovered.attemptCount,
                ])
              ).value,
              true,
            );
        } else
          check(
            "Long job completes under renewed lease",
            (await call(a, "completeClaim", 80, token)).value,
            true,
          );
      } else if (conditionId === "expired-renew") {
        check(
          "Expired token cannot renew",
          (await call(a, "renewClaim", 60, token)).value,
          false,
        );
        check(
          "Expired token cannot complete",
          (await call(a, "completeClaim", 60, token)).value,
          false,
        );
        const b = await start("B"),
          recovered = (await call(b, "claimNextDue", 60)).value;
        check(
          "Inclusive expiry recoverable",
          recovered?.attemptCount ?? null,
          generation + 2,
        );
        if (recovered)
          check(
            "Recovered token completes",
            (await call(b, "completeClaim", 61, [id, recovered.attemptCount]))
              .value,
            true,
          );
      } else {
        if (conditionId === "recovery" || conditionId === "different-input") {
          const receipt = await a.stop(true);
          trace.push({ kind: "process-killed", actor: "A", ...receipt });
          check("Exit observed", Boolean(receipt.pid), true);
        }
        const b = await start("B"),
          recovered = (await call(b, "claimNextDue", 90)).value;
        check("Expired job recovered", recovered?.id ?? null, id);
        check(
          "Recovery increments generation",
          recovered?.attemptCount ?? null,
          generation + 2,
        );
        if (conditionId === "stale") {
          check(
            "Stale token cannot renew",
            (await call(a, "renewClaim", 91, token)).value,
            false,
          );
          check(
            "Stale token cannot complete",
            (await call(a, "completeClaim", 91, token)).value,
            false,
          );
        }
        if (recovered)
          check(
            "Recovered token completes",
            (await call(b, "completeClaim", 92, [id, recovered.attemptCount]))
              .value,
            true,
          );
      }
    }
    const final = snapshot();
    check(
      "Job reaches durable completion",
      final.find((r) => r.id === id)?.status,
      "completed",
    );
    check(
      "Future job unchanged",
      final.find((r) => r.id === "future"),
      initial.find((r) => r.id === "future"),
    );
    const stored = final.find((r) => r.id === id);
    check(
      "Payload and due date preserved",
      [
        stored.incident_id,
        stored.due_at,
        stored.purpose,
        stored.idempotency_key,
        stored.created_at,
      ],
      [row[1], row[2], row[3], row[7], row[9]],
    );
  } catch (e) {
    status = "error";
    error = String(e.message ?? e).slice(0, 400);
    check("Execution completed", error, null);
  } finally {
    await Promise.all(actors.map((w) => w.stop()));
  }
  const state = snapshot();
  if (!resolve(directory).startsWith(resolve(tmpdir()) + sep))
    throw new Error("Unsafe temporary path.");
  await rm(directory, { recursive: true, force: true });
  return {
    engine: "tend-lifecycle-v2",
    condition: conditionId,
    sourceHash: sourceHash(source),
    status,
    error,
    initial,
    state,
    trace,
    verdict: {
      passed: status === "completed" && checks.every((c) => c.passed),
      checks,
    },
    scope: LIFECYCLE_CONTRACT,
  };
}
export async function verifyLifecycle(bundle, source, split = "all") {
  const cases = [];
  for (const c of LIFECYCLE_CASES.filter(
    (c) => split === "all" || c.split === split,
  )) {
    const run = await runLifecycle(bundle, source, c.id);
    cases.push({ id: c.id, split: c.split, passed: run.verdict.passed, run });
  }
  return { passed: cases.every((c) => c.passed), tested: cases.length, cases };
}
