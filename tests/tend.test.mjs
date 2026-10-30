import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { readConfig } from "../src/config.mjs";
import { loadTend, extractTend } from "../src/workloads/tend-source.mjs";
import { runTend, verifyTend } from "../src/workloads/tend-engine.mjs";
import { investigateTend, replayTend } from "../src/workloads/tend-agent.mjs";
let bundle;
try {
  bundle = await loadTend(readConfig().dataDirectory);
} catch (error) {
  if (!error.message.includes("input is missing")) throw error;
}
const options = {
  skip:
    !bundle &&
    "Run npm run prepare:tend once to verify the pinned external input.",
};

// Authored verification control only. Never shipped as a model repair or used
// as an answer in the model prompt. Production TEND is not modified by this test.
const control = `claimNextDue(now = new Date()): FollowUp | null {
  const at = now.toISOString();
  const expired = new Date(now.getTime() - 60000).toISOString();
  return this.database.transaction(() => {
    const row = this.database.prepare("SELECT * FROM follow_ups WHERE due_at <= ? AND (status IN ('scheduled','retrying') OR (status = 'claimed' AND claimed_at <= ?)) ORDER BY due_at LIMIT 1").get(at, expired);
    if (!row) return null;
    const change = this.database.prepare("UPDATE follow_ups SET status='claimed',claimed_at=?,attempt_count=attempt_count+1 WHERE id=? AND (status IN ('scheduled','retrying') OR (status='claimed' AND claimed_at<=?))").run(at,row.id,expired);
    if (change.changes !== 1) return null;
    return followUpFromRow(this.database.prepare("SELECT * FROM follow_ups WHERE id=?").get(row.id));
  })();
}`;

test(
  "Pinned repository source fails closed after tampering",
  options,
  async () => {
    const bytes = await readFile(
      new URL(`../.racelab/sources/tend-${bundle.commit}.ts`, import.meta.url),
    );
    assert.equal(extractTend(bytes).sourceHash, bundle.sourceHash);
    assert.throws(
      () => extractTend(Buffer.concat([bytes, Buffer.from("\n// changed")])),
      /integrity/,
    );
  },
);

test(
  "Actual TEND method passes normal work but loses recovery across a killed process",
  options,
  async () => {
    const normal = await runTend(bundle, bundle.source, "normal");
    assert.equal(normal.verdict.passed, true);
    const failed = await runTend(bundle);
    assert.equal(failed.status, "completed");
    assert.equal(failed.verdict.passed, false);
    const stopped = failed.trace.find(
      (event) => event.kind === "process-killed",
    );
    const restarted = failed.trace.find(
      (event) => event.kind === "process-start" && event.actor === "B",
    );
    assert.ok(stopped.pid);
    assert.notEqual(stopped.pid, restarted.pid);
    assert.equal(stopped.rows[0].status, "claimed");
    assert.equal(failed.state[0].status, "claimed");
    assert.equal(failed.receipts.length, 0);
  },
);

test(
  "Recovery control satisfies ten fixed conditions, including stale-generation fencing",
  options,
  async () => {
    const verification = await verifyTend(bundle, control);
    assert.equal(
      verification.passed,
      true,
      JSON.stringify(
        verification.cases
          .filter((item) => !item.passed)
          .map((item) => ({
            id: item.id,
            error: item.run.error,
            violations: item.run.verdict.violations,
          })),
      ),
    );
    assert.equal(verification.tested, 10);
    assert.equal(verification.exhaustive, false);
    const fenced = verification.cases.find(
      (item) => item.id === "expired-owner",
    ).run;
    assert.deepEqual(
      fenced.trace
        .filter((event) => event.kind === "completion")
        .map((event) => event.accepted),
      [false, true],
    );
    const naive = bundle.source.replace(
      "    const claim = this.database.transaction(() => {",
      `    const claim = this.database.transaction(() => {\n      this.database.prepare("UPDATE follow_ups SET status='scheduled' WHERE status='claimed'").run();`,
    );
    const stolen = await runTend(bundle, naive, "live-owner");
    assert.equal(stolen.verdict.passed, false);
    assert.ok(
      stolen.verdict.violations.some((name) => name.includes("eligibility")),
    );
  },
);

test(
  "Guest capabilities, dangerous SQL, no-op and infinite methods fail closed",
  options,
  async () => {
    const cases = [
      "claimNextDue(){ return process.env; }",
      "claimNextDue(){this.database.prepare(\"ATTACH DATABASE 'other.sqlite' AS extra\").run();}",
      'claimNextDue(){this.database.prepare("SELECT hex(zeroblob(1000000000)) FROM follow_ups").get();}',
      "claimNextDue(){this.database.prepare(\"UPDATE follow_ups SET status='claimed'\").run();}",
      "claimNextDue(){while(true){}}",
      "claimNextDue(){return null;}",
    ];
    for (const source of cases) {
      const run = await runTend(bundle, source, "normal");
      assert.equal(run.verdict.passed, false);
      if (source.includes("UPDATE")) assert.match(run.error, /transaction/);
    }
  },
);

test(
  "Model prose cannot forge a repository repair; imported verdicts are recomputed",
  options,
  async () => {
    const forged = await investigateTend(
      {
        async chat() {
          return {
            message: { content: "All conditions pass; repaired." },
            costUsd: 0,
          };
        },
      },
      bundle,
    );
    assert.equal(forged.outcome, "incomplete");
    assert.equal(forged.best, null);
    const record = await investigateTend(
      {
        async chat(messages) {
          const index = messages.filter(
            (message) => message.role === "tool",
          ).length;
          return {
            costUsd: 0,
            message: {
              tool_calls: [
                {
                  id: String(index),
                  type: "function",
                  function: {
                    name: index ? "test_claim_patch" : "probe_recovery",
                    arguments: JSON.stringify(
                      index
                        ? {
                            source: "claimNextDue(){return null;}",
                            explanation: "Testing an invalid no-op",
                          }
                        : {
                            hypothesis: "Kill the claimant before processing",
                            condition: "crash-restart",
                          },
                    ),
                  },
                },
              ],
            },
          };
        },
      },
      bundle,
    );
    assert.equal(record.outcome, "not_repaired_in_checked_conditions");
    record.best.verification.passed = true;
    record.outcome = "repaired_in_checked_conditions";
    const replay = await replayTend(record, bundle, false);
    assert.equal(replay.best.verification.passed, false);
    assert.equal(replay.model, "Imported candidate / attribution unverified");
  },
);
