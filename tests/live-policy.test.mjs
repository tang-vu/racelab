import test from "node:test";
import assert from "node:assert/strict";
import {
  newLiveBudget,
  availability,
  beginLiveJob,
  reserveLiveCall,
  settleLiveCall,
  LIVE_RESERVATION_MICROS,
  reviewLiveCharge,
} from "../deploy/cloudflare/src/live-policy.ts";

test("sponsored live repair accounting survives reconstruction and never overspends its allocation", () => {
  const state = newLiveBudget();
  beginLiveJob(state, "client-a", "job", 1000);
  reserveLiveCall(state, "call", 1001, "job");
  const restored = JSON.parse(JSON.stringify(state));
  assert.equal(restored.held, LIVE_RESERVATION_MICROS);
  assert.throws(
    () => beginLiveJob(restored, "client-b", "second", 1002),
    /Another/,
  );
  const settled = settleLiveCall(restored, "call", {
    prompt_tokens: 1000,
    completion_tokens: 500,
  });
  assert.equal(settled.known, true);
  assert.equal(restored.held, 0);
  assert.equal(restored.spent, 3375);
  assert.throws(() => settleLiveCall(restored, "call", {}), /Unknown/);
  restored.spent = restored.cap;
  assert.throws(
    () => reserveLiveCall(restored, "over", 1003, "job"),
    /exceeded/,
  );
});

test("an explicit conservative review retains the full uncertain charge and cap", () => {
  const state = newLiveBudget();
  state.spent = 1336050;
  state.blocked = "A model charge needs review.";
  reviewLiveCharge(
    state,
    "review-1",
    "Browser closed its stream during the first recording; retain the entire worst-case charge.",
    1,
  );
  assert.equal(state.spent, 1336050);
  assert.equal(state.cap, 2000000);
  assert.equal(state.reviews[0].chargedMicros, 1336050);
  assert.equal(availability(state, "client", 2).enabled, true);
  assert.throws(
    () =>
      reviewLiveCharge(
        state,
        "review-1",
        "duplicate operation should fail closed",
        3,
      ),
    /settled/,
  );
});

test("lost requests and missing usage retain conservative charges and pause live inference", () => {
  for (const interrupted of [false, true]) {
    const state = newLiveBudget();
    beginLiveJob(state, "client", "job", 0);
    reserveLiveCall(state, "one", 1, "job");
    if (interrupted)
      assert.throws(
        () => beginLiveJob(state, "other", "retry", 700000),
        /cost review/,
      );
    else settleLiveCall(state, "one", null);
    assert.equal(state.spent, LIVE_RESERVATION_MICROS);
    assert.equal(state.held, 0);
    assert.equal(availability(state, "other", 700001).enabled, false);
  }
});

test("an expired job cannot make calls using a newer job's lease", () => {
  const state = newLiveBudget();
  beginLiveJob(state, "client", "old", 0);
  beginLiveJob(state, "client", "new", 700000);
  assert.throws(
    () => reserveLiveCall(state, "stale", 700001, "old"),
    /no longer active/,
  );
  reserveLiveCall(state, "current", 700002, "new");
  assert.equal(state.pending.length, 1);
});

test("preview quotas cannot be bypassed by a new browser session on the same client identity", () => {
  const state = newLiveBudget();
  for (let i = 0; i < 6; i++) {
    beginLiveJob(state, "client", `job-${i}`, 1000 + i);
    state.active = null;
  }
  assert.equal(availability(state, "client", 3000).enabled, false);
  assert.equal(availability(state, "client", 3600001).enabled, true);
  const invalid = JSON.parse(JSON.stringify(state));
  invalid.cap++;
  assert.throws(
    () => availability(invalid, "client", 3600001),
    /cannot be verified/,
  );
});

test("changing provider preserves the existing allocation, Scout charges and pending receipts", () => {
  const state = newLiveBudget();
  state.spent = 7922;
  state.active = { id: "legacy", expires: 100000 };
  state.held = 37982;
  state.pending = [{ id: "legacy-call", micros: 37982, at: 0 }];
  const restored = JSON.parse(JSON.stringify(state));
  const charge = settleLiveCall(restored, "legacy-call", {
    prompt_tokens: 1000,
    completion_tokens: 500,
  });
  assert.equal(charge.costMicros, 695);
  assert.equal(restored.spent, 8617);
  assert.equal(restored.allocation, "racelab-public-scout-20261103");
  reserveLiveCall(restored, "muse-call", 10, "legacy");
  assert.equal(restored.pending[0].model, "muse-spark-1.3");
  assert.equal(restored.held, LIVE_RESERVATION_MICROS);
});
