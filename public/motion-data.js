import { impactFor, collisionPair } from "./evidence-view.js";

export function chapterSteps(run, caseId) {
  if (!run?.trace?.length) return [0, 0, 0];
  const relevant = (key) =>
    caseId === "last-seat"
      ? key === "stock"
      : caseId === "lost-update"
        ? key === "count"
        : key.startsWith("seen:");
  const reads = new Map();
  for (const event of run.trace)
    if (
      event.method === "get" &&
      relevant(event.key) &&
      !reads.has(event.actor)
    )
      reads.set(event.actor, event.step);
  const first = Math.max(0, ...reads.values());
  const writes = run.trace.filter((event) =>
    ["set", "append", "compareAndSwap", "insertOnce"].includes(event.method),
  );
  const second = Math.max(
    first,
    writes[Math.floor((writes.length - 1) / 2)]?.step ?? first,
  );
  return [first, second, run.trace.length];
}

export function replayFrame(fixture, run, step) {
  if (!fixture || !run) return null;
  const index = Math.max(
    0,
    Math.min(run.trace.length, Math.round(Number(step) || 0)),
  );
  const snapshot = index
    ? run.trace[index - 1].after
    : fixture.scenario.initial;
  const key =
    fixture.id === "last-seat"
      ? "stock"
      : fixture.id === "lost-update"
        ? "count"
        : "notifications";
  const reads = new Map();
  for (const event of run.trace.slice(0, index)) {
    const relevant =
      fixture.id === "webhook"
        ? event.key.startsWith("seen:")
        : event.key === key;
    if (event.method === "get" && relevant)
      reads.set(event.actor, event.result);
  }
  const pair = collisionPair(run, fixture.id);
  return {
    step: index,
    total: run.trace.length,
    key,
    memory: Array.isArray(snapshot[key]) ? snapshot[key].length : snapshot[key],
    readA: reads.has(0) ? reads.get(0) : undefined,
    readB: reads.has(1) ? reads.get(1) : undefined,
    impact: impactFor(fixture, snapshot),
    sharedRead: Boolean(pair && index >= pair.second),
    final: index === run.trace.length,
    verdict:
      index === run.trace.length
        ? run.status !== "completed"
          ? "ERROR"
          : run.verdict.passed
            ? "PASS"
            : "FAIL"
        : "REPLAY",
  };
}
