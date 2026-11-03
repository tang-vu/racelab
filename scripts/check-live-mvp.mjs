import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

// Explicit opt-in: unlike check:browser, this sends one fresh model investigation.
if (process.env.RACELAB_LIVE_CHECK !== "1")
  throw new Error(
    "Set RACELAB_LIVE_CHECK=1 to authorize one live MVP integration check.",
  );
const base = process.env.RACELAB_BASE_URL ?? "https://racelab.tangvu.dev";
assert.equal(new URL(base).protocol, "https:");
const output = new URL("../.racelab/cloudflare/mvp-browser/", import.meta.url);
await mkdir(output, { recursive: true });
const source = `claimNextDue(now = new Date()) {
  const at = now.toISOString();
  const expired = new Date(now.getTime() - 30000).toISOString();
  return this.database.transaction(() => {
    const selected = this.database.prepare(
      "SELECT * FROM follow_ups WHERE due_at <= ? AND (status IN ('scheduled', 'retrying') OR (status = 'claimed' AND claimed_at IS NOT NULL AND claimed_at <= ?)) ORDER BY due_at ASC LIMIT 1"
    ).get(at, expired);
    if (!selected) return null;
    this.database.prepare("UPDATE follow_ups SET status = 'claimed', claimed_at = ?, attempt_count = attempt_count + 1 WHERE id = ?").run(at, selected.id);
    return followUpFromRow(this.database.prepare("SELECT * FROM follow_ups WHERE id = ?").get(selected.id));
  })();
}`;
await writeFile(
  new URL("protocol.json", output),
  JSON.stringify(
    {
      createdAt: new Date().toISOString(),
      scope:
        "One fresh-input UI integration check after protocol/schema feedback changes. Not a retry of the frozen studies. Prior integration failure is retained.",
      sourceHash: createHash("sha256").update(source).digest("hex"),
      source,
      maxInvestigations: 1,
    },
    null,
    2,
  ),
  { flag: "wx" },
);
const browser = await chromium.launch({ channel: "msedge", headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  acceptDownloads: true,
});
context.setDefaultTimeout(60000);
const page = await context.newPage();
const errors = [];
let investigations = 0,
  terminal;
page.on("pageerror", (e) => errors.push(e.message));
page.on("request", (request) => {
  if (new URL(request.url()).pathname === "/api/live/repair") investigations++;
});
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
try {
  await page.goto(base + "/tend.html", { waitUntil: "networkidle" });
  await settled();
  assert.equal(await page.locator("#project-live").isEnabled(), true);
  await page.locator("#project-file-input").setInputFiles({
    name: "short-lease.ts",
    mimeType: "text/plain",
    buffer: Buffer.from(`class MyJobs {\n${source}\n}`),
  });
  assert.equal(await page.locator("#native-source").inputValue(), source);
  await page.locator("#native-condition").selectOption("live-owner");
  await page.locator("#native-run").click();
  await settled();
  assert.equal(await page.locator("#native-verdict").textContent(), "FAIL");
  const completed = page.waitForResponse(
    (r) => new URL(r.url()).pathname === "/api/live/repair",
  );
  await page.locator("#project-live").click();
  const response = await completed;
  assert.equal(response.status(), 200);
  const body = await response.text();
  const event = body
    .split("\n\n")
    .filter((s) => s.startsWith("data: "))
    .map((s) => JSON.parse(s.slice(6)))
    .find((e) => e.type === "complete");
  assert.ok(event, "terminal live report");
  terminal = event.result;
  await writeFile(
    new URL("live-report.json", output),
    JSON.stringify(terminal, null, 2),
  );
  console.log(
    JSON.stringify({
      stage: "live",
      model: terminal.model,
      requests: terminal.requests,
      costUsd: terminal.costUsd,
      outcome: terminal.outcome,
      error: terminal.error ?? null,
    }),
  );
  await settled();
  assert.equal(terminal.startingSource, source);
  assert.equal(terminal.origin, "live_meta");
  assert.equal(
    terminal.best?.verification.passed,
    true,
    "new live candidate must pass the real oracle",
  );
  assert.equal(terminal.best.verification.tested, 10);
  assert.match(
    await page.locator("#native-verification").textContent(),
    /10 OF 10 CONDITIONS/,
  );
  await page.locator("#project-save").click();
  const saved = await page.locator("#project-list").inputValue();
  await page.locator("#project-new").click();
  await page.locator("#project-list").selectOption(saved);
  await settled();
  assert.match(
    await page.locator("#native-verification").textContent(),
    /10 OF 10 CONDITIONS/,
  );
  await page.reload({ waitUntil: "networkidle" });
  await settled();
  await page.locator("#project-recover").click();
  await settled();
  assert.match(
    await page.locator("#native-verification").textContent(),
    /10 OF 10 CONDITIONS/,
  );
  const downloadEvent = page.waitForEvent("download");
  await page.locator("#native-export").click();
  const download = await downloadEvent;
  await download.saveAs(fileURLToPath(new URL("regression.json", output)));
  const exported = JSON.parse(
    await readFile(new URL("regression.json", output), "utf8"),
  );
  assert.equal(exported.recomputed, true);
  await page.locator("#native-import").click();
  await page.locator("#native-import-json").fill(JSON.stringify(exported));
  await page.locator("#native-import-confirm").click();
  await settled();
  assert.match(
    await page.locator("#native-verification").textContent(),
    /10 OF 10 CONDITIONS/,
  );
  const stranger = await browser.newContext();
  try {
    const privateRun = await stranger.request.get(
      base + "/api/live/jobs/" + terminal.runId,
      { headers: { "x-racelab-owner": "forged" } },
    );
    assert.equal(privateRun.status(), 404);
    const csrf = await stranger.request.post(base + "/api/live/repair", {
      data: { source },
      headers: { Origin: "https://example.com" },
    });
    assert.equal(csrf.status(), 403);
  } finally {
    await stranger.close();
  }
  for (const width of [1440, 390, 320]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.locator(".method-project").scrollIntoViewIfNeeded();
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      `no overflow at ${width}`,
    );
    await page.screenshot({
      path: fileURLToPath(new URL(`workspace-${width}.png`, output)),
      animations: "disabled",
    });
  }
  assert.equal(investigations, 1);
  assert.deepEqual(errors, []);
  await writeFile(
    new URL("result.json", output),
    JSON.stringify(
      {
        passed: true,
        investigations,
        model: terminal.model,
        requests: terminal.requests,
        costUsd: terminal.costUsd,
        checked: 10,
        privateReportIsolated: true,
        projectReopened: true,
        recovered: true,
        exportImported: true,
        widths: [1440, 390, 320],
      },
      null,
      2,
    ),
  );
  console.log(
    "MVP browser integration passed: fresh Meta repair, actual 10/10 checks, project reopen, recovery, export/import and private ownership. One investigation.",
  );
} finally {
  await context.close();
  await browser.close();
}
