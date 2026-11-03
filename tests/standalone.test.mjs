import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { mkdtemp, rm, readFile, access } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { BudgetLedger, openLedger } from "../src/budget.mjs";
import { createHash } from "node:crypto";

const root = fileURLToPath(new URL("../", import.meta.url));
async function temporary(t) {
  const directory = await mkdtemp(join(tmpdir(), "racelab-extract-"));
  t.after(async () => {
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep));
    await rm(directory, { recursive: true, force: true });
  });
  return directory;
}

test("A configured existing ledger cannot silently become a new budget", async (t) => {
  const directory = await temporary(t);
  const policy = { total: 150, phase: 10, reserve: 50 };
  await assert.rejects(
    openLedger({ ...policy, ledgerDirectory: directory, ledgerRequired: true }),
    /not reset/,
  );
  await assert.rejects(access(join(directory, "usage.json")));
  const original = new BudgetLedger(directory, policy);
  const reservation = await original.reserve("spark", 1);
  await original.settle(reservation, 0.25);
  const extracted = await openLedger({
    ...policy,
    ledgerDirectory: directory,
    ledgerRequired: true,
  });
  assert.equal((await extracted.summary()).spentUsd, 0.25);
  assert.equal((await extracted.summary()).requests, 1);
});

test("Standalone server serves RaceLab at root and excludes old apps and private files", async (t) => {
  const directory = await temporary(t);
  const probe = createServer();
  probe.listen(0, "127.0.0.1");
  await once(probe, "listening");
  const port = probe.address().port;
  await new Promise((done) => probe.close(done));
  const child = spawn(process.execPath, ["server.mjs"], {
    cwd: root,
    env: {
      ...process.env,
      MODEL_API_KEY: "",
      HOST: "127.0.0.1",
      PORT: String(port),
      RACELAB_PUBLIC_ORIGIN: "",
      RACELAB_DEMO_ACCESS_CODE: "",
      RACELAB_LEDGER_DIR: "",
      RACELAB_DATA_DIR: directory,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  t.after(async () => {
    if (child.exitCode === null) {
      const exited = once(child, "exit");
      child.kill();
      await exited;
    }
  });
  const [ready] = await once(child.stdout, "data", {
    signal: AbortSignal.timeout(15000),
  });
  assert.match(ready.toString(), /RaceLab is ready/);
  const base = `http://127.0.0.1:${port}`;
  const page = await fetch(base);
  const html = await page.text();
  assert.equal(page.status, 200);
  assert.match(html, /id="project-live"/);
  assert.match(html, /live repair workbench/);
  const store = await fetch(base + "/store");
  assert.equal(store.status, 200);
  assert.match(await store.text(), /It passes alone/);
  for (const method of ["GET", "HEAD"]) {
    const legacy = await fetch(base + "/tend.html?from=old-link", {
      method,
      redirect: "manual",
    });
    assert.equal(legacy.status, 308);
    assert.equal(legacy.headers.get("location"), "/?from=old-link");
  }
  assert.doesNotMatch(html, /Earlier LiveWorld|\/racelab\/racelab.css/);
  for (const path of [
    "/kept/",
    "/demo/",
    "/shared/world.js",
    "/.env.local",
    "/.racelab/usage.json",
    "/src/config.mjs",
    "/package.json",
  ]) {
    assert.equal((await fetch(base + path)).status, 404, path);
  }
  for (const path of [
    "/racelab.css",
    "/racelab.js",
    "/motion.css",
    "/experience.js",
    "/motion-data.js",
    "/font.css",
    "/film.html",
    "/racelab-demo.vtt",
  ]) {
    assert.equal((await fetch(base + path)).status, 200, path);
  }
  const fonts = JSON.parse(
    await readFile(join(root, "public/fonts/font-origin.json")),
  );
  for (const font of fonts.fonts) {
    const response = await fetch(base + "/fonts/" + font.file);
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /font\/woff2/);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.equal(bytes.length, font.bytes);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), font.sha256);
  }
  const license = await (
    await fetch(base + "/fonts/OFL-Google-Sans-Flex.txt")
  ).text();
  assert.match(license, /SIL OPEN FONT LICENSE Version 1.1/);
  const status = await (await fetch(base + "/api/status")).json();
  assert.equal(status.configured, false);
  assert.equal(status.budget.requests, 0);
  const range = await fetch(base + "/racelab-demo.mp4", {
    headers: { Range: "bytes=0-31" },
  });
  assert.equal(range.status, 206);
  assert.equal((await range.arrayBuffer()).byteLength, 32);
  const packageInfo = JSON.parse(await readFile(join(root, "package.json")));
  assert.deepEqual(Object.keys(packageInfo.dependencies), [
    "quickjs-emscripten",
  ]);
});
