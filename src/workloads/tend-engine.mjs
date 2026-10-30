import { fork } from "node:child_process";
import { DatabaseSync } from "node:sqlite";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { TEND, sourceHash, compileClaim } from "./tend-source.mjs";

export const CONDITIONS = Object.freeze([
  {
    id: "normal",
    title: "Finish without interruption",
    mode: "normal",
    description: "One due job is claimed and completed.",
  },
  {
    id: "crash-restart",
    title: "Crash after the committed claim",
    mode: "crash",
    description:
      "Kill A before processing; B opens the same SQLite file after the lease expires.",
  },
  {
    id: "live-owner",
    title: "Keep a live owner's job",
    mode: "live",
    description: "B must not steal A's 30-second-old claim.",
  },
  {
    id: "expired-owner",
    title: "Reject the previous generation",
    mode: "stale",
    description:
      "A stays alive. B reclaims after 90 seconds; A's old token cannot complete.",
  },
  {
    id: "future",
    title: "Leave a future job alone",
    mode: "ineligible",
    initial: "future",
    description: "A job due in an hour is not runnable now.",
  },
  {
    id: "completed",
    title: "Do not replay finished work",
    mode: "ineligible",
    initial: "completed",
    description: "A completed job stays completed.",
  },
  {
    id: "retry",
    title: "Preserve the retry path",
    mode: "normal",
    initial: "retrying",
    description: "A due retry can still be claimed and completed.",
  },
  {
    id: "mixed",
    title: "Recover only the eligible row",
    mode: "crash",
    initial: "mixed",
    description:
      "Recover a lost claim without changing another completed or future job.",
  },
  {
    id: "lease-edge",
    title: "Recover at the lease boundary",
    mode: "stale",
    delay: 60_000,
    description:
      "An exactly 60-second-old claim expires. Its old generation stays fenced.",
  },
  {
    id: "different-input",
    title: "Change IDs, date and attempt count",
    mode: "crash",
    variant: true,
    description:
      "Repeat crash recovery with different IDs and an existing retry generation.",
  },
]);
const plus = (iso, ms) => new Date(new Date(iso).getTime() + ms).toISOString();
const serial = (value) => JSON.stringify(value);
function initialRows(condition, now) {
  const job = {
    id: condition.variant ? "followup-copper" : "followup-blue",
    incident_id: "incident-fixture",
    due_at: plus(now, -60_000),
    purpose: "LOCAL FIXTURE: observe a follow-up; no delivery",
    status: condition.initial === "retrying" ? "retrying" : "scheduled",
    attempt_count: condition.variant ? 7 : 0,
    last_error: null,
    idempotency_key: condition.variant ? "key-copper" : "key-blue",
    claimed_at: null,
    created_at: plus(now, -3_600_000),
    completed_at: null,
  };
  if (condition.initial === "future") job.due_at = plus(now, 3_600_000);
  if (condition.initial === "completed") {
    job.status = "completed";
    job.completed_at = plus(now, -20_000);
  }
  if (condition.initial !== "mixed") return [job];
  return [
    job,
    {
      ...job,
      id: "future-protected",
      idempotency_key: "key-future",
      due_at: plus(now, 3_600_000),
    },
    {
      ...job,
      id: "completed-protected",
      idempotency_key: "key-done",
      status: "completed",
      completed_at: plus(now, -10_000),
    },
  ];
}
function seed(path, rows) {
  const db = new DatabaseSync(path);
  try {
    db.exec(
      "PRAGMA journal_mode=WAL; CREATE TABLE follow_ups(id TEXT PRIMARY KEY,incident_id TEXT NOT NULL,due_at TEXT NOT NULL,purpose TEXT NOT NULL,status TEXT NOT NULL,attempt_count INTEGER NOT NULL,last_error TEXT,idempotency_key TEXT NOT NULL UNIQUE,claimed_at TEXT,created_at TEXT NOT NULL,completed_at TEXT);",
    );
    const insert = db.prepare(
      "INSERT INTO follow_ups VALUES(?,?,?,?,?,?,?,?,?,?,?)",
    );
    for (const row of rows) insert.run(...Object.values(row));
  } finally {
    db.close();
  }
}
function snapshot(path) {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    return db
      .prepare("SELECT * FROM follow_ups ORDER BY id")
      .all()
      .map((row) => ({ ...row }));
  } finally {
    db.close();
  }
}

function actor(path, input, label) {
  const child = fork(new URL("./claim-worker.mjs", import.meta.url), [], {
    env: {},
    execArgv: [],
    stdio: ["ignore", "ignore", "ignore", "ipc"],
    windowsHide: true,
  });
  let next = 0,
    ended = false,
    exitReceipt;
  const pending = new Map();
  const exited = new Promise((resolve) =>
    child.once("exit", (code, signal) => {
      ended = true;
      exitReceipt = { pid: child.pid, code, signal };
      for (const item of pending.values()) {
        clearTimeout(item.timer);
        item.reject(new Error("Worker exited before returning evidence."));
      }
      pending.clear();
      resolve(exitReceipt);
    }),
  );
  child.on("message", (message) => {
    const item = pending.get(message.id);
    if (!item) return;
    pending.delete(message.id);
    clearTimeout(item.timer);
    if (message.error) item.reject(new Error(message.error));
    else item.resolve(message);
  });
  child.on("error", () => {
    for (const item of pending.values()) {
      clearTimeout(item.timer);
      item.reject(new Error("The workload worker could not start."));
    }
    pending.clear();
  });
  const call = (message) =>
    new Promise((resolve, reject) => {
      if (ended) return reject(new Error("The worker has exited."));
      const id = ++next,
        timer = setTimeout(() => {
          pending.delete(id);
          child.kill();
          reject(new Error("Workload worker exceeded eight seconds."));
        }, 8000);
      pending.set(id, { resolve, reject, timer });
      child.send({ ...message, id }, (error) => {
        if (error) {
          clearTimeout(timer);
          pending.delete(id);
          reject(new Error("Could not send work to the isolated process."));
        }
      });
    });
  return {
    label,
    pid: child.pid,
    ready: call({ command: "init", path, input }),
    call,
    async stop(hard = false) {
      if (!ended) {
        if (hard) child.kill();
        else child.disconnect();
      }
      return await exited;
    },
  };
}

export async function runTend(
  bundle,
  source = bundle.source,
  conditionId = "crash-restart",
) {
  compileClaim(source);
  const condition = CONDITIONS.find((item) => item.id === conditionId);
  if (!condition)
    throw new Error("Choose one of the declared TEND conditions.");
  const now = condition.variant
    ? "2027-02-12T09:30:00.000Z"
    : "2026-10-30T12:00:00.000Z";
  const directory = await mkdtemp(join(tmpdir(), "racelab-tend-")),
    path = join(directory, "jobs.sqlite");
  const initial = initialRows(condition, now),
    actors = [],
    trace = [],
    checks = [],
    receipts = [];
  let status = "completed",
    error = null;
  let currentAt = now;
  const add = (event) => {
    if (event.at) currentAt = event.at;
    trace.push({ step: trace.length + 1, ...event });
  };
  const check = (name, passed, actual, expected) =>
    checks.push({ name, passed: Boolean(passed), actual, expected });
  const start = async (label, at = now) => {
    const worker = actor(
      path,
      { source, rowAdapter: bundle.rowAdapter },
      label,
    );
    actors.push(worker);
    await worker.ready;
    add({
      kind: "process-start",
      actor: label,
      pid: worker.pid,
      at,
      rows: snapshot(path),
    });
    return worker;
  };
  const claim = async (worker, at) => {
    const before = snapshot(path);
    const eligible = before.filter(
      (row) =>
        row.due_at <= at &&
        (["scheduled", "retrying"].includes(row.status) ||
          (row.status === "claimed" &&
            row.claimed_at !== null &&
            row.claimed_at <= plus(at, -TEND.leaseMs))),
    );
    const result = await worker.call({ command: "claim", at });
    for (const event of result.trace)
      add({ ...event, actor: worker.label, pid: worker.pid, at });
    const after = snapshot(path),
      value = result.claim;
    add({
      kind: "claim-result",
      actor: worker.label,
      pid: worker.pid,
      at,
      claim: value,
      rows: after,
    });
    check(
      `${worker.label}: claim eligibility`,
      Boolean(value) === Boolean(eligible.length),
      value?.id ?? null,
      eligible.map((row) => row.id),
    );
    if (!value) {
      check(
        `${worker.label}: declined claim preserves all rows`,
        serial(before) === serial(after),
        after,
        before,
      );
      return null;
    }
    const old = before.find((row) => row.id === value.id),
      row = after.find((row) => row.id === value.id);
    check(
      `${worker.label}: returned job is eligible`,
      eligible.some((row) => row.id === value.id),
      value.id,
      eligible.map((row) => row.id),
    );
    check(
      `${worker.label}: durable generation increments once`,
      row &&
        old &&
        row.attempt_count === old.attempt_count + 1 &&
        value.attemptCount === row.attempt_count,
      { stored: row?.attempt_count, returned: value.attemptCount },
      old ? old.attempt_count + 1 : null,
    );
    check(
      `${worker.label}: durable claim uses the supplied clock`,
      row?.status === "claimed" && row.claimed_at === at,
      { status: row?.status, claimedAt: row?.claimed_at },
      { status: "claimed", claimedAt: at },
    );
    const mutable = new Set(["status", "attempt_count", "claimed_at"]);
    const preserved =
      before.length === after.length &&
      before.every((previous) => {
        const current = after.find((row) => row.id === previous.id);
        return (
          current &&
          Object.keys(previous).every(
            (key) =>
              (previous.id === value.id && mutable.has(key)) ||
              serial(previous[key]) === serial(current[key]),
          )
        );
      });
    check(
      `${worker.label}: preserve payload, deadlines and other jobs`,
      preserved,
      after,
      "Only status, attempt_count and claimed_at on the claimed row may change",
    );
    return value;
  };
  const complete = async (worker, job, at, expected = true) => {
    if (!job) {
      check(
        `${worker.label}: expected local completion`,
        !expected,
        false,
        expected,
      );
      return;
    }
    const result = await worker.call({
      command: "complete",
      jobId: job.id,
      attempt: job.attemptCount,
      at,
    });
    add({
      kind: "completion",
      actor: worker.label,
      pid: worker.pid,
      at,
      jobId: job.id,
      generation: job.attemptCount,
      accepted: result.completed,
      before: result.before ?? null,
      after: result.after ?? null,
    });
    check(
      `${worker.label}: ${expected ? "current" : "stale"} generation completion`,
      result.completed === expected,
      result.completed,
      expected,
    );
    if (result.completed)
      receipts.push({
        jobId: job.id,
        generation: job.attemptCount,
        actor: worker.label,
        kind: "local-fixture-completion",
      });
  };
  try {
    seed(path, initial);
    add({ kind: "initial", at: now, rows: snapshot(path) });
    const a = await start("A"),
      first = await claim(a, now);
    if (condition.mode === "normal") await complete(a, first, plus(now, 1000));
    else if (condition.mode === "ineligible") {
      const b = await start("B", plus(now, 1000));
      await claim(b, plus(now, 1000));
    } else if (condition.mode === "live") {
      const b = await start("B", plus(now, 30_000));
      await claim(b, plus(now, 30_000));
      await complete(a, first, plus(now, 31_000));
    } else {
      if (condition.mode === "crash") {
        const exit = await a.stop(true);
        add({
          kind: "process-killed",
          actor: "A",
          at: plus(now, 1000),
          ...exit,
          reason:
            "Stopped after the committed claim and before the fixture processor",
          rows: snapshot(path),
        });
        check(
          "Killed worker exited before restart",
          Boolean(exit.pid),
          exit.pid,
          "Observed process exit",
        );
      }
      const later = plus(now, condition.delay ?? 90_000),
        b = await start("B", later),
        second = await claim(b, later);
      if (condition.mode === "stale")
        await complete(a, first, plus(later, 1), false);
      await complete(b, second, plus(later, 1000));
    }
    const expected = condition.mode === "ineligible" ? 0 : 1;
    check(
      "Exactly the expected local fixture completions",
      receipts.length === expected,
      receipts.length,
      expected,
    );
    const final = snapshot(path);
    const protectedRows = initial.filter(
      (row) => row.id.includes("protected") || condition.mode === "ineligible",
    );
    check(
      "Ineligible jobs retain their persisted state",
      protectedRows.every(
        (row) =>
          serial(row) === serial(final.find((after) => after.id === row.id)),
      ),
      final.filter((row) => protectedRows.some((p) => p.id === row.id)),
      protectedRows,
    );
    add({ kind: "final", at: currentAt, rows: final, receipts });
    return finish(final);
  } catch (caught) {
    status = "error";
    error = String(caught?.message ?? caught).slice(0, 400);
    check(
      "Execution completed within adapter boundaries",
      false,
      error,
      "Completed execution",
    );
    add({ kind: "error", message: error });
    return finish(snapshot(path));
  } finally {
    await Promise.allSettled(actors.map((worker) => worker.stop()));
    if (
      !resolve(directory).startsWith(resolve(tmpdir()) + sep) ||
      !directory.includes("racelab-tend-")
    )
      throw new Error("Unexpected temporary workload directory.");
    await rm(directory, { recursive: true, force: true });
  }
  function finish(state) {
    return {
      engine: TEND.adapter,
      caseId: TEND.id,
      condition: condition.id,
      title: condition.title,
      sourceHash: sourceHash(source),
      status,
      error,
      initial,
      state,
      trace,
      receipts,
      verdict: {
        passed: status === "completed" && checks.every((item) => item.passed),
        checks,
        violations: checks
          .filter((item) => !item.passed)
          .map((item) => item.name),
      },
      scope:
        "Pinned TEND claim method; actual disposable SQLite; controlled process/clock boundaries; local fixture completion with a fixed generation guard, not Discord or full TEND deployment.",
    };
  }
}

export async function verifyTend(bundle, source = bundle.source) {
  compileClaim(source);
  const cases = [];
  for (const condition of CONDITIONS) {
    const run = await runTend(bundle, source, condition.id);
    cases.push({
      id: condition.id,
      title: condition.title,
      passed: run.verdict.passed,
      run,
    });
  }
  return {
    engine: TEND.adapter,
    sourceHash: sourceHash(source),
    passed: cases.every((item) => item.passed),
    tested: cases.length,
    failures: cases.filter((item) => !item.passed).length,
    exhaustive: false,
    cases,
    scope:
      "Ten predeclared process/clock conditions. Not an exhaustive scheduler, arbitrary repository runner or production correctness proof.",
  };
}
