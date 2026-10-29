import { getQuickJS } from "quickjs-emscripten";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { validateSource } from "./fixtures.mjs";
import { judge } from "./oracle.mjs";

export const ENGINE_VERSION = "racelab-quickjs-v1";
export const sourceHash = (source) =>
  createHash("sha256").update(source).digest("hex");
const copy = (value) => structuredClone(value);
const jsonValue = (value) => {
  const text = JSON.stringify(value ?? null);
  if (text.length > 20000)
    throw new Error("Store value exceeds the 20KB limit.");
  return JSON.parse(text);
};
const equal = (a, b) => isDeepStrictEqual(a ?? null, b ?? null);

export async function execute(source, scenario, options = {}) {
  validateSource(source);
  if (
    !scenario ||
    !scenario.initial ||
    !Array.isArray(scenario.requests) ||
    scenario.requests.length < 1 ||
    scenario.requests.length > 4
  )
    throw new Error("A scenario needs 1–4 requests and an initial store.");
  if (JSON.stringify(scenario).length > 30000)
    throw new Error("Scenario too large.");
  if (
    options.schedule &&
    (!Array.isArray(options.schedule) ||
      options.schedule.length > 96 ||
      options.schedule.some(
        (actor) =>
          !Number.isInteger(actor) ||
          actor < 0 ||
          actor >= scenario.requests.length,
      ))
  )
    throw new Error("A schedule contains at most 96 valid request indices.");
  const QuickJS = await getQuickJS();
  const runtime = QuickJS.newRuntime();
  runtime.setMemoryLimit(24 * 1024 * 1024);
  runtime.setMaxStackSize(256 * 1024);
  const expires = Date.now() + 1000;
  let interrupts = 0;
  runtime.setInterruptHandler(
    () => Date.now() > expires || ++interrupts > 2000,
  );
  const vm = runtime.newContext();
  const state = copy(scenario.initial);
  const pending = [];
  const locks = new Map();
  const deferred = [];
  const taskHandles = [];
  const trace = [];
  const decisions = [];
  const results = [];
  let status = "completed";
  let error = null;
  let handle;
  let moduleHandle;
  let seed = (options.seed ?? 1) >>> 0;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const toVM = (value) =>
    vm.unwrapResult(vm.evalCode(`(${JSON.stringify(value ?? null)})`));
  const drain = () => {
    let count = 0;
    while (runtime.hasPendingJob()) {
      if (++count > 300) throw new Error("Promise job limit reached.");
      const result = runtime.executePendingJobs(1);
      if (result.error) {
        const detail = vm.dump(result.error);
        result.error.dispose();
        throw new Error(detail?.message ?? "Promise execution failed.");
      }
    }
  };
  try {
    vm.unwrapResult(
      vm.evalCode(`Object.defineProperty(globalThis, "Date", {value: undefined});
      Object.defineProperty(Math, "random", {value: () => {throw new Error("Use the controlled scheduler; random is disabled.")}});`),
    ).dispose();
    moduleHandle = vm.unwrapResult(
      vm.evalCode(source, "handler.js", { type: "module" }),
    );
    handle = vm.getProp(moduleHandle, "handle");
    if (vm.typeof(handle) !== "function")
      throw new Error("Export an async function handle(db, request).");
    for (let actor = 0; actor < scenario.requests.length; actor++) {
      const db = vm.newObject();
      for (const [method, argc] of Object.entries({
        get: 1,
        set: 2,
        append: 2,
        compareAndSwap: 3,
        insertOnce: 2,
        lock: 1,
        unlock: 1,
      })) {
        const fn = vm.newFunction(method, (...args) => {
          if (args.length !== argc)
            throw new Error(`${method} expects ${argc} argument(s).`);
          if (pending.length > 64 || deferred.length >= 128)
            throw new Error("Store operation limit reached.");
          const values = args.map((arg) => jsonValue(vm.dump(arg)));
          if (
            typeof values[0] !== "string" ||
            values[0].length < 1 ||
            values[0].length > 160 ||
            ["__proto__", "prototype", "constructor"].includes(values[0])
          )
            throw new Error("Store keys must contain 1–160 characters.");
          const promise = vm.newPromise();
          deferred.push(promise);
          pending.push({ actor, method, args: values, promise });
          return promise.handle;
        });
        vm.setProp(db, method, fn);
        fn.dispose();
      }
      const request = toVM(scenario.requests[actor]);
      const task = vm.unwrapResult(
        vm.callFunction(handle, vm.undefined, db, request),
      );
      db.dispose();
      request.dispose();
      taskHandles.push(task);
    }
    drain();
    let steps = 0;
    while (true) {
      let settled = 0;
      for (let actor = 0; actor < taskHandles.length; actor++) {
        const task = vm.getPromiseState(taskHandles[actor]);
        if (task.type === "fulfilled") {
          results[actor] = jsonValue(vm.dump(task.value));
          task.value.dispose();
          settled++;
        } else if (task.type === "rejected") {
          const detail = vm.dump(task.error);
          task.error.dispose();
          throw new Error(
            `Request ${actor + 1}: ${detail?.message ?? String(detail)}`,
          );
        }
      }
      if (settled === taskHandles.length) {
        if (pending.length || locks.size)
          throw new Error(
            "A handler finished with pending operations or unreleased locks.",
          );
        break;
      }
      if (steps++ >= 96) throw new Error("The 96-operation limit was reached.");
      const runnable = pending.filter(
        (operation) =>
          operation.method !== "lock" || !locks.has(operation.args[0]),
      );
      const eligible = [
        ...new Set(runnable.map((operation) => operation.actor)),
      ].sort();
      if (!eligible.length)
        throw new Error("Deadlock: no store operation can make progress.");
      let actor;
      if (options.schedule && decisions.length < options.schedule.length) {
        actor = options.schedule[decisions.length];
        if (!eligible.includes(actor))
          throw new Error(
            `Schedule step ${decisions.length + 1} selects a blocked or finished request.`,
          );
      } else if (options.strategy === "random")
        actor = eligible[Math.floor(random() * eligible.length)];
      else if (options.strategy === "round-robin") {
        const previous = decisions.at(-1)?.actor ?? -1;
        actor = eligible.find((item) => item > previous) ?? eligible[0];
      } else actor = eligible[0];
      const operation = runnable.find((item) => item.actor === actor);
      pending.splice(pending.indexOf(operation), 1);
      decisions.push({ actor, eligible });
      const [key, value, replacement] = operation.args;
      const before = copy(state);
      let result;
      if (
        ["set", "compareAndSwap", "insertOnce"].includes(operation.method) &&
        Array.isArray(scenario.initial[key])
      )
        throw new Error(
          "Receipt collections are append-only. Their history cannot be rewritten.",
        );
      switch (operation.method) {
        case "get":
          result = state[key] ?? null;
          break;
        case "set":
          state[key] = copy(value);
          result = true;
          break;
        case "append":
          if (!Array.isArray(state[key]) || state[key].length >= 64)
            throw new Error(
              "append needs an existing collection with fewer than 64 records.",
            );
          state[key].push(copy(value));
          result = state[key].length;
          break;
        case "compareAndSwap":
          result = equal(state[key], value);
          if (result) state[key] = copy(replacement);
          break;
        case "insertOnce":
          result = !Object.hasOwn(state, key);
          if (result) state[key] = copy(value);
          break;
        case "lock":
          locks.set(key, actor);
          result = true;
          break;
        case "unlock":
          if (locks.get(key) !== actor)
            throw new Error("Only the lock owner can unlock it.");
          locks.delete(key);
          result = true;
          break;
      }
      const event = {
        step: trace.length + 1,
        actor,
        method: operation.method,
        key,
        args: copy(operation.args),
        result: copy(result),
        before,
        after: copy(state),
      };
      trace.push(event);
      const resultHandle = toVM(result);
      operation.promise.resolve(resultHandle);
      resultHandle.dispose();
      drain();
    }
  } catch (failure) {
    status = "error";
    error = String(failure?.message ?? failure).slice(0, 600);
  } finally {
    for (const task of taskHandles) if (task.alive) task.dispose();
    if (handle?.alive) handle.dispose();
    if (moduleHandle?.alive) moduleHandle.dispose();
    for (const promise of deferred) if (promise.alive) promise.dispose();
    vm.dispose();
    runtime.dispose();
  }
  return {
    engine: ENGINE_VERSION,
    sourceHash: sourceHash(source),
    status,
    error,
    state,
    results,
    trace,
    decisions,
    schedule: decisions.map((item) => item.actor),
  };
}

export async function runCase(id, source, scenario, options = {}) {
  const result = await execute(source, scenario, options);
  return { ...result, verdict: judge(id, scenario, result) };
}

export async function explore(
  id,
  source,
  scenario,
  { limit = 64, stopOnFailure = false, seed = 13, strategy = "dfs" } = {},
) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 192)
    throw new Error("Schedule limit must be 1–192.");
  const stack = [[]];
  const queued = new Set(["[]"]);
  const schedules = new Set();
  const summaries = [];
  let firstFailure = null;
  let firstPass = null;
  let attempts = 0;
  while (
    (strategy === "random" || stack.length) &&
    summaries.length < limit &&
    attempts < limit * 8
  ) {
    const prefix = strategy === "random" ? null : stack.pop();
    const run = await runCase(
      id,
      source,
      scenario,
      strategy === "random"
        ? { strategy: "random", seed: seed + attempts * 7919 }
        : { schedule: prefix },
    );
    attempts++;
    const key = JSON.stringify(run.schedule);
    if (!schedules.has(key)) {
      schedules.add(key);
      summaries.push({
        schedule: run.schedule,
        passed: run.verdict.passed,
        violations: run.verdict.violations,
        error: run.error,
      });
      if (!run.verdict.passed && !firstFailure) firstFailure = run;
      if (run.verdict.passed && !firstPass) firstPass = run;
      if (firstFailure && stopOnFailure) break;
    }
    if (strategy !== "random") {
      for (let i = run.decisions.length - 1; i >= 0; i--) {
        for (const other of [...run.decisions[i].eligible].reverse()) {
          if (other === run.decisions[i].actor) continue;
          const next = [...run.schedule.slice(0, i), other];
          const nextKey = JSON.stringify(next);
          if (!queued.has(nextKey)) {
            queued.add(nextKey);
            stack.push(next);
          }
        }
      }
    }
  }
  return {
    engine: ENGINE_VERSION,
    sourceHash: sourceHash(source),
    strategy,
    tested: summaries.length,
    attempts,
    exhaustive:
      strategy === "dfs" &&
      stack.length === 0 &&
      !(stopOnFailure && firstFailure),
    passed: summaries.filter((run) => run.passed).length,
    failed: summaries.filter((run) => !run.passed).length,
    firstFailure,
    firstPass,
    schedules: summaries,
  };
}

export async function verifyPatch(fixture, source, limit = 40) {
  const cases = [];
  for (const [index, scenario] of [
    fixture.scenario,
    ...fixture.additional,
  ].entries()) {
    const sweep = await explore(fixture.id, source, scenario, { limit });
    cases.push({ index, scenario, ...sweep });
  }
  return {
    passed: cases.every((item) => item.failed === 0 && item.tested > 0),
    exhaustive: cases.every((item) => item.exhaustive),
    tested: cases.reduce((sum, item) => sum + item.tested, 0),
    failures: cases.reduce((sum, item) => sum + item.failed, 0),
    cases,
  };
}
