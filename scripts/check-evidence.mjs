import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
const base = process.env.RACELAB_CHECK_URL || "http://127.0.0.1:4174";
const out = resolve(".racelab/evidence-browser");
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
try {
  for (const width of [1440, 390, 320, 768]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage(),
      errors = [],
      api = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/api/**", (route) => {
      api.push(route.request().url());
      return route.abort();
    });
    await page.goto(base + "/evidence.html");
    await page
      .getByRole("status")
      .filter({ hasText: "Recording integrity verified" })
      .waitFor();
    assert.equal(await page.locator("#evidence-verdict").textContent(), "FAIL");
    assert.equal(
      await page.locator("#evidence-completions").textContent(),
      "0",
    );
    await page.locator("#version-b").click();
    assert.equal(
      await page.locator("#evidence-completions").textContent(),
      "1",
    );
    assert.equal(await page.locator("#evidence-verdict").textContent(), "PASS");
    await page.locator("#evidence-condition").selectOption("expired-owner");
    assert.match(
      await page.locator("#evidence-checks").textContent(),
      /stale generation completionActual: false/,
    );
    await page.locator("#evidence-start").click();
    assert.equal(
      await page.locator("#evidence-verdict").textContent(),
      "REPLAY",
    );
    assert.match(
      await page.locator("#evidence-processes").textContent(),
      /not started/,
    );
    await page.locator("#evidence-play").click();
    await page.waitForFunction(
      () => document.querySelector("#evidence-scrubber").value !== "0",
    );
    await page.locator("#evidence-play").click();
    await page.locator("#evidence-end").click();
    assert.equal(await page.locator("#evidence-verdict").textContent(), "PASS");
    await page.locator("#version-a").click();
    assert.equal(
      await page.locator("#evidence-verdict").textContent(),
      "NOT RECORDED",
    );
    assert.equal(await page.locator("#evidence-playback").isVisible(), false);
    await page.locator("#evidence-matrix button").nth(1).click();
    await page
      .locator("#evidence-investigation details")
      .first()
      .locator("summary")
      .click();
    assert.match(
      await page.locator("#evidence-investigation").textContent(),
      /"passed": false/,
    );
    await page.locator("#theme-toggle").click();
    assert.equal(await page.locator("html").getAttribute("data-theme"), "dark");
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      `overflow at ${width}`,
    );
    assert.deepEqual(errors, []);
    assert.deepEqual(api, []);
    await page.screenshot({
      path: resolve(out, `explorer-${width}.png`),
      fullPage: true,
    });
    await page.goto(base + "/evaluation.html");
    await page
      .getByText("Saved evaluation artifacts loaded.", { exact: false })
      .waitFor();
    assert.equal(await page.locator(".evaluation-table tbody tr").count(), 12);
    assert.equal(
      await page
        .locator(".evaluation-table tbody tr")
        .filter({ hasText: "not-run-after-stop" })
        .count(),
      0,
    );
    assert.match(
      await page.locator("#comparison-summary").textContent(),
      /post-hoc deviation/i,
    );
    assert.match(
      await page.locator("#repository-summary").textContent(),
      /OpenMusic · 14\/14/,
    );
    assert.match(
      await page.locator("#repository-summary").textContent(),
      /airules · 6\/8/,
    );
    assert.equal(await page.locator("#lifecycle-cases > details").count(), 11);
    assert.match(
      await page.locator("#lifecycle-summary").textContent(),
      /Meta lifecycle candidate · 10\/10/,
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
      true,
      `evaluation overflow at ${width}`,
    );
    assert.deepEqual(errors, []);
    assert.deepEqual(api, []);
    await page.screenshot({
      path: resolve(out, `evaluation-${width}.png`),
      fullPage: true,
    });
    await context.close();
    console.log(`Recorded explorer ${width}px PASS; no API calls`);
  }
  const context = await browser.newContext(),
    page = await context.newPage();
  await page.route("**/recordings/tend-claims.json", (route) =>
    route.fulfill({ contentType: "application/json", body: "{}" }),
  );
  await page.goto(base + "/evidence.html");
  await page
    .getByText("Recording integrity failed. Evidence was not opened.")
    .waitFor();
  assert.equal(await page.locator("#version-b").isDisabled(), true);
  await context.close();
  console.log("Tampered recording refused PASS");
} finally {
  await browser.close();
}
