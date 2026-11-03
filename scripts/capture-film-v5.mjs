import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { resolve, join } from "node:path";
import { extractClaimMethod } from "../public/method-project.js";

if (!process.argv.includes("--live"))
  throw new Error(
    "Explicit --live is required for one fresh Muse Spark film capture.",
  );
const base = "https://racelab.tangvu.dev",
  work = resolve(
    process.argv.find((a) => a.startsWith("--capture-dir="))?.slice(14) ??
      ".racelab/film-muse-mvp",
  ),
  published = resolve("docs/mvp-film-shots");
await mkdir(join(work, "raw"), { recursive: true });
await mkdir(published, { recursive: true });
let protocol;
try {
  protocol = JSON.parse(await readFile(join(work, "capture-protocol.json")));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  const input = await readFile("demo/mvp-film-input.ts", "utf8");
  protocol = {
    createdAt: new Date().toISOString(),
    model: "muse-spark-1.3",
    source: extractClaimMethod(input),
    maxInvestigations: 1,
    maxTurns: 6,
    maxCandidates: 2,
    scope:
      "Authored film integration, separate from frozen studies; retain unsuccessful attempts.",
  };
  await writeFile(
    join(work, "capture-protocol.json"),
    JSON.stringify(protocol, null, 2),
    { flag: "wx" },
  );
  await writeFile(join(work, "worker-claims.ts"), input, { flag: "wx" });
}
await writeFile(
  join(work, "capture-started.json"),
  JSON.stringify({
    startedAt: new Date().toISOString(),
    protocol: sha(JSON.stringify(protocol)),
  }),
  { flag: "wx" },
);
function sha(value) {
  return createHash("sha256").update(value).digest("hex");
}
const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  acceptDownloads: true,
  recordVideo: { dir: join(work, "raw"), size: { width: 1440, height: 900 } },
});
const page = await context.newPage();
page.setDefaultTimeout(60000);
const errors = [],
  marks = {};
let paid = 0,
  report;
page.on("pageerror", (e) => errors.push(e.message));
await context.route("**/*", (route) => {
  const u = new URL(route.request().url());
  if (u.pathname === "/api/live/repair") {
    paid++;
    if (paid > 1) return route.abort();
  }
  return u.origin === base && !u.pathname.endsWith("/agent")
    ? route.continue()
    : route.abort();
});
const at = () => Date.now();
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
const scroll = async (selector) =>
  page
    .locator(selector)
    .first()
    .evaluate((el) =>
      scrollTo({
        top: el.getBoundingClientRect().top + scrollY - 95,
        behavior: "instant",
      }),
    );
const settled = async () => {
  await page.waitForFunction(
    () => !document.body.classList.contains("busy"),
    null,
    { timeout: 240000 },
  );
  assert.equal(
    await page.locator("#native-status").isVisible(),
    false,
    await page.locator("#native-status").textContent(),
  );
};
const openedAt = at();
let raw;
try {
  await page.goto(base + "/", { waitUntil: "networkidle" });
  await settled();
  assert.match(
    await page.locator("#project-live-note").textContent(),
    /Muse Spark/,
  );
  await scroll(".method-project");
  await pause(400);
  marks.input = at();
  await pause(1000);
  await page
    .locator("#project-file-input")
    .setInputFiles(join(work, "worker-claims.ts"));
  assert.equal(
    await page.locator("#native-source").inputValue(),
    protocol.source,
  );
  await page.locator("#project-name").fill("Worker claim recovery");
  await pause(1000);
  await scroll(".native-workbench");
  await page.locator("#native-condition").selectOption("live-owner");
  await page.locator("#native-run").click();
  await settled();
  assert.equal(await page.locator("#native-verdict").textContent(), "FAIL");
  await pause(1000);
  await scroll(".method-project");
  const terminal = page.waitForResponse(
    (r) => new URL(r.url()).pathname === "/api/live/repair",
  );
  marks.live = at();
  await page.locator("#project-live").click();
  const response = await terminal;
  assert.equal(response.status(), 200);
  await writeFile(
    join(work, "job.json"),
    JSON.stringify({ jobId: response.headers()["x-racelab-job-id"] }),
  );
  await scroll("#native-investigation");
  await settled();
  const liveExport = page.waitForEvent("download");
  await page.locator("#native-export").click();
  const liveFile = await liveExport;
  await liveFile.saveAs(join(work, "live-report.json"));
  report = JSON.parse(await readFile(join(work, "live-report.json"), "utf8"));
  assert.ok(report, "terminal live report");
  assert.equal(report.model, "muse-spark-1.3");
  assert.equal(
    report.best?.verification.passed,
    true,
    report.error ?? "fresh candidate must pass actual checks",
  );
  assert.equal(report.best.verification.tested, 10);
  assert.equal(report.startingSource, protocol.source);
  await scroll("#native-verification");
  marks.result = at();
  console.log(
    JSON.stringify({
      model: report.model,
      requests: report.requests,
      costUsd: report.costUsd,
      passed: 10,
      sourceHash: report.startingSourceHash,
    }),
  );
  await page.screenshot({
    path: join(work, "live-result.png"),
    animations: "disabled",
  });
  await pause(10000);
  marks.proof = at();
  await page
    .locator("#native-verification [data-native-condition='live-owner']")
    .click();
  await scroll(".native-workbench");
  await pause(2500);
  await page.locator("#native-original").click();
  await pause(1800);
  await page.locator("#native-candidate").click();
  await pause(2000);
  await scroll("#native-investigation");
  for (const detail of await page
    .locator("#native-investigation details")
    .all())
    await detail.evaluate((el) => {
      el.open = true;
    });
  await pause(2500);
  await scroll(".method-project");
  await page.locator("#project-save").click();
  const saved = await page.locator("#project-list").inputValue();
  assert.ok(saved);
  await pause(1200);
  const downloadEvent = page.waitForEvent("download");
  await page.locator("#native-export").click();
  const download = await downloadEvent;
  const regression = join(work, "worker-claim-regression.json");
  await download.saveAs(regression);
  await pause(Math.max(0, 21000 - (at() - marks.proof)));
  marks.import = at();
  await page.locator("#native-import").click();
  await page.locator("#native-import-file").setInputFiles(regression);
  await pause(2000);
  await page.locator("#native-import-confirm").click();
  marks.importSent = at();
  await settled();
  assert.match(
    await page.locator("#native-verification").textContent(),
    /10 OF 10 CONDITIONS/,
  );
  await scroll("#native-verification");
  await pause(2500);
  await scroll(".method-project");
  await page.locator("#project-recover").click();
  await settled();
  assert.match(
    await page.locator("#native-verification").textContent(),
    /muse-spark-1.3/,
  );
  await scroll("#native-verification");
  marks.recovered = at();
  await pause(6500);
  await scroll(".method-project");
  await pause(7500);
  marks.end = at();
  assert.equal(paid, 1);
  assert.deepEqual(errors, []);
  await writeFile(
    join(work, "capture-timeline.json"),
    JSON.stringify(
      {
        openedAt,
        marks,
        investigations: paid,
        model: report.model,
        requests: report.requests,
        costUsd: report.costUsd,
        runId: report.runId,
        sourceHash: report.startingSourceHash,
        candidateHash: report.best.sourceHash,
        checked: 10,
        errors,
        browser: await browser.version(),
        viewport: { width: 1440, height: 900 },
      },
      null,
      2,
    ),
  );
} finally {
  await context.close();
  raw = await page.video().path();
  await writeFile(join(work, "raw-video-path.txt"), raw);
  await browser.close();
}
console.log(
  "Fresh Muse capture and actual save/export/import/recovery completed.",
);
