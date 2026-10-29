// This code runs outside the submitted module. Model output cannot alter it.
import { isDeepStrictEqual as same } from "node:util";

export function judge(id, scenario, run) {
  const checks = [];
  const check = (name, passed, actual, expected) =>
    checks.push({ name, passed: Boolean(passed), actual, expected });
  const initial = scenario.initial;
  const state = run.state;
  const requests = scenario.requests;
  check(
    "All requests finish",
    run.status === "completed",
    run.status,
    "completed",
  );
  if (id === "last-seat") {
    const orders = Array.isArray(state.orders) ? state.orders : [];
    const quantity = orders.reduce(
      (sum, order) =>
        sum + (Number.isInteger(order.quantity) ? order.quantity : NaN),
      0,
    );
    check(
      "Never oversell",
      quantity <= initial.stock &&
        state.stock >= 0 &&
        run.trace.every((event) => event.after.stock >= 0),
      quantity,
      `≤ ${initial.stock}`,
    );
    check(
      "Stock is conserved",
      quantity + state.stock === initial.stock,
      quantity + state.stock,
      initial.stock,
    );
    const possible = Math.min(
      initial.stock,
      requests.reduce((sum, request) => sum + request.quantity, 0),
    );
    check(
      "Available seats are filled",
      quantity === possible,
      quantity,
      possible,
    );
    const valid = orders.every((order) =>
      requests.some(
        (request) =>
          order.requestId === request.id && order.quantity === request.quantity,
      ),
    );
    const unique =
      new Set(orders.map((order) => order.requestId)).size === orders.length;
    check(
      "Receipts match distinct requests",
      valid && unique,
      orders.length,
      "one receipt per accepted request",
    );
    check(
      "Responses match committed orders",
      run.results.length === requests.length &&
        run.results.every(
          (result, i) =>
            result?.accepted ===
            orders.some((order) => order.requestId === requests[i].id),
        ),
      run.results,
      "accepted iff its order exists",
    );
  } else if (id === "webhook") {
    const notifications = Array.isArray(state.notifications)
      ? state.notifications
      : [];
    const expected = [
      ...new Map(requests.map((request) => [request.id, request])).values(),
    ].filter((request) => !initial[`seen:${request.id}`]);
    check(
      "Exactly one message per fresh event",
      notifications.length === expected.length &&
        expected.every(
          (request) =>
            notifications.filter(
              (note) =>
                note.eventId === request.id &&
                note.to === request.to &&
                note.body === request.body,
            ).length === 1,
        ),
      notifications.length,
      expected.length,
    );
    check(
      "Event IDs are recorded",
      requests.every((request) => state[`seen:${request.id}`] === true),
      requests.map((r) => state[`seen:${r.id}`] ?? null),
      "all true",
    );
    check(
      "Responses match sent messages",
      run.results.length === requests.length &&
        run.results.every((r) => typeof r?.sent === "boolean") &&
        run.results.filter((r) => r?.sent === true).length === expected.length,
      run.results,
      `${expected.length} sent response(s)`,
    );
  } else if (id === "lost-update") {
    const expected =
      initial.count + requests.reduce((sum, request) => sum + request.delta, 0);
    check("No update is lost", state.count === expected, state.count, expected);
    const applied = Array.isArray(state.applied) ? state.applied : [];
    check(
      "Every request has one matching receipt",
      applied.length === requests.length &&
        requests.every(
          (request) =>
            applied.filter(
              (row) =>
                row.requestId === request.id && row.delta === request.delta,
            ).length === 1,
        ),
      applied.length,
      requests.length,
    );
    check(
      "Responses confirm completion",
      run.results.length === requests.length &&
        run.results.every((r) => r?.applied === true),
      run.results,
      "all applied",
    );
  } else throw new Error("Unsupported contract.");
  const writable =
    id === "last-seat"
      ? ["stock", "orders"]
      : id === "webhook"
        ? ["notifications", ...requests.map((r) => `seen:${r.id}`)]
        : ["count", "applied"];
  const stableKeys = Object.keys(initial).filter(
    (key) => !writable.includes(key),
  );
  check(
    "Unrelated state is preserved",
    [state, ...run.trace.map((event) => event.after)].every(
      (snapshot) =>
        stableKeys.every((key) => same(snapshot[key], initial[key])) &&
        Object.keys(snapshot).every(
          (key) => Object.hasOwn(initial, key) || writable.includes(key),
        ),
    ),
    stableKeys,
    "unchanged; no unrelated keys",
  );
  return {
    passed: checks.every((row) => row.passed),
    checks,
    violations: checks.filter((row) => !row.passed).map((row) => row.name),
  };
}
