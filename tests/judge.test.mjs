import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { request as httpRequest } from "node:http";
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  access,
  rm,
  copyFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { TEND } from "../src/workloads/tend-source.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));

test("judge configuration ignores a colocated private env file", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "racelab-judge-config-"));
  t.after(async () => {
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep));
    await rm(directory, { recursive: true, force: true });
  });
  await mkdir(join(directory, "src"));
  await copyFile(
    join(root, "src", "config.mjs"),
    join(directory, "src", "config.mjs"),
  );
  await writeFile(
    join(directory, ".env.local"),
    "MODEL_API_KEY=test-only-secret\nRACELAB_LEDGER_DIR=must-not-open\nRACELAB_TOTAL_BUDGET_USD=invalid\n",
  );
  const child = spawn(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      "import { readConfig } from './src/config.mjs'; const c=readConfig(); console.log(JSON.stringify({hasKey:Boolean(c.key),hasLedger:c.ledgerRequired,total:c.total}));",
    ],
    {
      cwd: directory,
      env: { RACELAB_JUDGE_MODE: "1" },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  let output = "";
  child.stdout.on("data", (bytes) => {
    output += bytes;
  });
  const [code] = await once(child, "close");
  assert.equal(code, 0);
  assert.deepEqual(JSON.parse(output), {
    hasKey: false,
    hasLedger: false,
    total: 150,
  });
});

test(
  "public judge server re-executes repairs without keys, a ledger or trusted imported verdicts",
  { timeout: 90_000 },
  async (t) => {
    const directory = await mkdtemp(join(tmpdir(), "racelab-judge-"));
    t.after(async () => {
      assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep));
      await rm(directory, { recursive: true, force: true });
    });
    const sourceName = `tend-${TEND.commit}.ts`;
    await mkdir(join(directory, "sources"));
    await writeFile(
      join(directory, "sources", sourceName),
      await readFile(join(root, ".racelab", "sources", sourceName)),
    );
    const probe = createServer();
    probe.listen(0, "127.0.0.1");
    await once(probe, "listening");
    const port = probe.address().port;
    await new Promise((done) => probe.close(done));
    const env = {
      ...process.env,
      MODEL_API_KEY: "",
      RACELAB_LEDGER_DIR: "",
      RACELAB_DATA_DIR: directory,
      RACELAB_PUBLIC_ORIGIN: "https://judge.test",
      RACELAB_DEMO_ACCESS_CODE: "",
      HOST: "127.0.0.1",
      PORT: String(port),
    };
    const child = spawn(process.execPath, ["scripts/serve-judge.mjs"], {
      cwd: root,
      env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    t.after(async () => {
      if (child.exitCode === null) {
        const exited = once(child, "exit");
        child.kill();
        await exited;
      }
    });
    const [ready] = await once(child.stdout, "data", {
      signal: AbortSignal.timeout(15_000),
    });
    assert.match(ready.toString(), /RaceLab is ready/);
    const request = (path, body, extra = {}) =>
      new Promise((resolve, reject) => {
        const outgoing = httpRequest(
          `http://127.0.0.1:${port}${path}`,
          {
            method: body === undefined ? "GET" : "POST",
            headers: {
              host: "judge.test",
              origin: "https://judge.test",
              "Content-Type": "application/json",
              ...extra,
            },
          },
          (response) => {
            const chunks = [];
            response.on("data", (chunk) => chunks.push(chunk));
            response.on("end", () =>
              resolve(
                new Response(Buffer.concat(chunks), {
                  status: response.statusCode,
                }),
              ),
            );
            response.on("error", reject);
          },
        );
        outgoing.on("error", reject);
        outgoing.end(body === undefined ? undefined : JSON.stringify(body));
      });
    const api = async (path, body) => {
      const response = await request(path, body);
      const result = await response.json();
      assert.equal(response.status, 200, result.error);
      return result;
    };
    const status = await api("/api/status");
    assert.equal(status.configured, false); // Even when the development .env.local exists.
    assert.equal(status.mode, "public-recheck");
    assert.equal(status.runner, "hosted");
    assert.equal(status.budget, null);
    assert.equal(status.accessRequired, false);
    for (const path of ["/api/racelab/agent", "/api/workloads/tend/agent"]) {
      const response = await request(path, {});
      assert.equal(response.status, 403);
      assert.equal((await response.json()).code, "PUBLIC_RECHECK_ONLY");
    }
    assert.equal(
      (
        await request(
          "/api/workloads/tend/execute",
          {},
          { origin: "https://attacker.test" },
        )
      ).status,
      403,
    );
    assert.equal(
      (await request("/api/status", undefined, { host: "attacker.test" }))
        .status,
      403,
    );
    for (const path of [
      "/.env.local",
      "/.racelab/usage.json",
      "/src/config.mjs",
    ])
      assert.equal((await request(path)).status, 404);
    const normal = await api("/api/workloads/tend/execute", {
      action: "run",
      condition: "normal",
    });
    assert.equal(normal.verdict.passed, true);
    const crash = await api("/api/workloads/tend/execute", {
      action: "run",
      condition: "crash-restart",
    });
    assert.equal(crash.verdict.passed, false);
    assert.ok(crash.trace.some((event) => event.kind === "process-killed"));
    const replay = await api("/api/workloads/tend/replay", { recorded: true });
    assert.equal(replay.best.verification.passed, true);
    assert.equal(replay.best.verification.tested, 10);
    assert.equal(replay.recomputed, true);
    replay.best.verification = { passed: false, tested: -1 };
    replay.patches.forEach((patch) => {
      patch.verification = { passed: false, tested: -1 };
    });
    const imported = await api("/api/workloads/tend/replay", {
      report: replay,
    });
    assert.equal(imported.best.verification.passed, true);
    assert.equal(imported.best.verification.tested, 10);
    assert.match(imported.model, /unverified/);
    await assert.rejects(access(join(directory, "usage.json")));
  },
);

test("judge mode refuses credentials and external accounting before listening", async () => {
  for (const settings of [
    { MODEL_API_KEY: "test-only-secret" },
    { RACELAB_LEDGER_DIR: "must-not-open" },
  ]) {
    const child = spawn(process.execPath, ["scripts/serve-judge.mjs"], {
      cwd: root,
      env: {
        ...process.env,
        MODEL_API_KEY: "",
        RACELAB_LEDGER_DIR: "",
        ...settings,
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
    let output = "";
    child.stdout.on("data", (bytes) => {
      output += bytes;
    });
    child.stderr.on("data", (bytes) => {
      output += bytes;
    });
    const [code] = await once(child, "close");
    assert.equal(code, 1);
    assert.match(output, /must have no model key or accounting ledger/);
    assert.doesNotMatch(
      output,
      /test-only-secret|must-not-open|RaceLab is ready/,
    );
  }
});
