import test from "node:test";
import assert from "node:assert/strict";
import {
  RUNNER_ORIGIN,
  trustedRequest,
  requestForRunner,
} from "../deploy/cloudflare/src/origin.ts";

const custom = "https://racelab.tangvu.dev";
test("public aliases accept their own origin and reject cross-origin submissions", () => {
  for (const origin of [custom, RUNNER_ORIGIN]) {
    assert.equal(trustedRequest(new Request(origin), custom), true);
    assert.equal(
      trustedRequest(
        new Request(origin, { method: "POST", headers: { origin } }),
        custom,
      ),
      true,
    );
    for (const foreign of [
      "https://example.invalid",
      origin === custom ? RUNNER_ORIGIN : custom,
      "null",
    ])
      assert.equal(
        trustedRequest(
          new Request(origin, { method: "POST", headers: { origin: foreign } }),
          custom,
        ),
        false,
      );
    assert.equal(
      trustedRequest(
        new Request(origin, {
          method: "POST",
          headers: { "sec-fetch-site": "cross-site" },
        }),
        custom,
      ),
      false,
    );
  }
  assert.equal(
    trustedRequest(new Request("https://example.invalid"), custom),
    false,
  );
  assert.equal(
    trustedRequest(new Request("http://racelab.tangvu.dev"), custom),
    false,
  );
});

test("runner forwarding preserves regression bodies while normalizing trusted host and port", async () => {
  for (const origin of [custom, RUNNER_ORIGIN]) {
    const body = JSON.stringify({
      report: { source: "claimNextDue() {}", verdict: "must be recomputed" },
    });
    const original = new Request(origin + "/api/workloads/tend/replay?test=1", {
      method: "POST",
      headers: {
        origin,
        host: new URL(origin).host,
        "Content-Type": "application/json",
        "cf-container-target-port": "22",
      },
      body,
    });
    const forwarded = requestForRunner(original);
    assert.equal(
      forwarded.url,
      RUNNER_ORIGIN + "/api/workloads/tend/replay?test=1",
    );
    assert.equal(forwarded.headers.get("host"), new URL(RUNNER_ORIGIN).host);
    assert.equal(forwarded.headers.get("origin"), RUNNER_ORIGIN);
    assert.equal(forwarded.headers.has("cf-container-target-port"), false);
    assert.equal(forwarded.method, "POST");
    assert.equal(await forwarded.text(), body);
  }
  const get = requestForRunner(new Request(custom + "/healthz"));
  assert.equal(get.headers.has("origin"), false);
});
