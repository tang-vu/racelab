import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const base = process.env.RACELAB_BASE_URL ?? "http://127.0.0.1:4174";
const reviewUrl = new URL(base);
const loopback = /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base);
const hosted =
  process.env.RACELAB_PUBLIC_CHECK === "1" &&
  reviewUrl.protocol === "https:" &&
  reviewUrl.origin === base;
if (!loopback && !hosted)
  throw new Error(
    "Choose a loopback preview, or explicitly enable RACELAB_PUBLIC_CHECK=1 for one HTTPS origin.",
  );
const output = new URL("../.racelab/browser-review/", import.meta.url);
await mkdir(output, { recursive: true });
const status = async () => (await fetch(base + "/api/status")).json();
const before = await status();
const browser = await chromium.launch({
  channel: process.env.RACELAB_BROWSER_CHANNEL ?? "msedge",
  headless: true,
});
const report = {
  format: "racelab-browser-review-v1",
  browser: await browser.version(),
  channel: process.env.RACELAB_BROWSER_CHANNEL ?? "msedge",
  capturedAt: new Date().toISOString(),
  sources: {},
  views: [],
  errors: [],
  paidAttempts: 0,
};
let currentPage;
async function capture(name, locator) {
  const file = new URL(name + ".png", output);
  if (locator)
    await locator.evaluate((el) =>
      scrollTo({
        top: el.getBoundingClientRect().top + scrollY - 100,
        behavior: "instant",
      }),
    );
  await currentPage.screenshot({
    path: fileURLToPath(file),
    animations: "disabled",
  });
  report.sources[name] = {
    type: "app-screenshot",
    method: `Playwright / fresh Microsoft Edge context / actual ${hosted ? "hosted" : "local"} application`,
    url: currentPage.url(),
    viewport: currentPage.viewportSize(),
    sha256: createHash("sha256")
      .update(await readFile(file))
      .digest("hex"),
  };
}
async function settled(page) {
  await page.waitForFunction(() => !document.body.classList.contains("busy"));
  assert.equal(await page.locator("#native-status").isVisible(), false);
}
async function click(page, selector) {
  await page.locator(selector).click();
  await settled(page);
}
async function download(page, selector, filename) {
  const pending = page.waitForEvent("download");
  await click(page, selector);
  const item = await pending;
  await item.saveAs(fileURLToPath(new URL(filename, output)));
  return readFile(new URL(filename, output), "utf8");
}
try {
  for (const width of [1440, 390, 320, 768]) {
    const context = await browser.newContext({
      viewport: { width, height: width > 1000 ? 1000 : 844 },
      deviceScaleFactor: 1,
      acceptDownloads: true,
      reducedMotion: width === 320 ? "reduce" : "no-preference",
    });
    context.setDefaultTimeout(60_000);
    await context.route("**/*", (route) => {
      const url = new URL(route.request().url());
      const paid =
        url.pathname.endsWith("/agent") || url.pathname === "/api/live/repair";
      if (paid) report.paidAttempts++;
      return url.origin === base && !paid ? route.continue() : route.abort();
    });
    const page = (currentPage = await context.newPage());
    page.on("pageerror", (error) => report.errors.push(error.message));
    await page.goto(base + "/");
    assert.equal(new URL(page.url()).pathname, "/");
    await page.waitForFunction(
      () => document.querySelector("#stop-verdict")?.textContent === "FAIL",
    );
    await page.evaluate(() => document.fonts.ready);
    await settled(page);
    assert.equal(await page.locator("#normal-verdict").textContent(), "PASS");
    assert.equal(await page.locator("#native-actual").textContent(), "0");
    assert.match(
      await page.locator("#source-proof").textContent(),
      /SOURCE VERIFIED/,
    );
    const overflow = await page.evaluate(() => ({
      viewport: innerWidth,
      content: document.documentElement.scrollWidth,
    }));
    assert.ok(
      overflow.content <= overflow.viewport,
      `${width}px horizontal overflow`,
    );
    report.views.push({ width, overflow, reducedMotion: width === 320 });
    if (width === 320)
      assert.equal(
        await page.locator("html").getAttribute("data-motion"),
        "paused",
      );
    await capture(`${width}-intro`);
    await capture(`${width}-workbench`, page.locator("#tend-lab"));
    if (width === 1440) {
      await page.evaluate(() => scrollTo(0, 0));
      await capture("01-overview");
      await page.locator("#native-condition").selectOption("normal");
      await settled(page);
      assert.equal(await page.locator("#native-verdict").textContent(), "PASS");
      await capture("02-normal", page.locator("#tend-lab"));
      await page.locator("#native-condition").selectOption("crash-restart");
      await settled(page);
      assert.equal(
        await page.locator("#worker-a-status").textContent(),
        "terminated",
      );
      await capture("03-interrupted", page.locator("#tend-lab"));
    }
    if (width === 1440 || width === 390) {
      await click(page, "#native-recorded");
      assert.equal(await page.locator("#native-verdict").textContent(), "PASS");
      assert.equal(await page.locator("#native-actual").textContent(), "1");
      assert.equal(
        await page.locator("#native-source").getAttribute("readonly"),
        "",
      );
      assert.match(
        await page.locator("#native-verification").textContent(),
        /10 OF 10 CONDITIONS/,
      );
      if (width === 1440) {
        await capture("04-candidate", page.locator("#tend-lab"));
        await capture("05-matrix", page.locator("#native-evidence"));
      } else await capture("390-matrix", page.locator("#native-evidence"));
      await click(page, '[data-native-condition="expired-owner"]');
      assert.match(
        await page.locator("#native-trace").textContent(),
        /completion rejected/,
      );
      await page.locator("#native-trace").evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      if (width === 1440)
        await capture("06-stale-owner", page.locator("#tend-lab"));
      await click(page, "#theme-toggle");
      assert.equal(
        await page.locator("html").getAttribute("data-theme"),
        "dark",
      );
      await capture(`${width}-dark`, page.locator("#tend-lab"));
      await click(page, "#theme-toggle");
      if (width === 1440) {
        const exported = await download(
          page,
          "#native-export",
          "regression.json",
        );
        assert.equal(JSON.parse(exported).recomputed, true);
        assert.match(
          await download(page, "#native-diff", "method.diff"),
          /claimNextDue/,
        );
        await click(page, "#native-import");
        await page
          .locator("#native-import-file")
          .setInputFiles(fileURLToPath(new URL("regression.json", output)));
        await page.waitForFunction(
          () =>
            document.querySelector("#native-import-json").value.length > 100,
        );
        await capture("07-portable-report");
        await click(page, "#native-import-confirm");
        assert.equal(
          await page.locator("#native-import-dialog").isVisible(),
          false,
        );
        assert.match(
          await page.locator("#native-verification").textContent(),
          /attribution unverified/,
        );
        await click(page, "#native-original");
        const source = await page.locator("#native-source").inputValue();
        await page
          .locator("#native-source")
          .fill(source + "\n// edited locally");
        assert.equal(
          await page.locator("#native-candidate").isDisabled(),
          true,
        );
        assert.equal(await page.locator("#native-export").isDisabled(), true);
        await page.locator("#native-recorded").click();
        await page.waitForFunction(() =>
          document
            .querySelector("#native-status")
            .textContent.includes("Reset your edits"),
        );
        await click(page, "#native-reset");
        assert.equal(await page.locator("#native-source").inputValue(), source);
        await capture("08-scope", page.locator(".source-panel"));
        await click(page, "#native-play");
        await page.waitForFunction(
          () => Number(document.querySelector("#native-scrubber").value) > 0,
        );
        await click(page, "#native-play");
      }
    }
    // Store experiments remain accessible from the main workbench.
    await page.locator('a[href="/store#workspace"]').last().click();
    assert.equal(new URL(page.url()).pathname, "/store");
    await page.waitForFunction(
      () => document.querySelector("#source")?.value?.length > 0,
    );
    await page.evaluate(() => document.fonts.ready);
    assert.ok(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    );
    await capture(`${width}-landing`);
    await context.close();
    console.log(
      `Edge ${width}px: executed baselines, layout${width === 1440 || width === 390 ? ", recorded repair, ten conditions and theme" : ""} passed.`,
    );
  }
  const filmContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  filmContext.setDefaultTimeout(60_000);
  const film = await filmContext.newPage();
  film.on("pageerror", (error) => report.errors.push(error.message));
  await film.goto(base + "/film.html");
  await film.waitForFunction(
    () => document.querySelector("video").readyState >= 1,
  );
  const duration = await film.locator("video").evaluate((el) => el.duration);
  assert.ok(duration >= 179.8 && duration <= 180);
  assert.equal(await film.locator("[data-seek]").count(), 8);
  const chapterStarts = await film
    .locator("[data-seek]")
    .evaluateAll((items) => items.map((item) => Number(item.dataset.seek)));
  for (const start of chapterStarts) {
    await film.locator(`[data-seek="${start}"]`).click();
    await film.waitForFunction((time) => {
      const video = document.querySelector("video");
      return (
        !video.paused &&
        video.currentTime >= time &&
        video.currentTime < time + 5
      );
    }, start);
    await film.locator("video").evaluate(async (video) => {
      if (video.seeking)
        await new Promise((done) =>
          video.addEventListener("seeked", done, { once: true }),
        );
      await new Promise((done) => video.requestVideoFrameCallback(done));
    });
    await film.waitForFunction(
      (time) =>
        document
          .querySelector(`[data-seek="${time}"]`)
          .getAttribute("aria-current") === "true",
      start,
    );
  }
  assert.equal(await film.locator("video").evaluate((el) => el.error), null);
  await film.waitForFunction(
    () => document.querySelector("track").readyState === 2,
  );
  report.film = {
    duration,
    chapters: 8,
    seekAndPlay: chapterStarts,
    captionsLoaded: true,
  };
  await film.locator("video").evaluate((el) => el.pause());
  await film
    .locator("video")
    .screenshot({ path: fileURLToPath(new URL("film-player.png", output)) });
  await film.setViewportSize({ width: 320, height: 844 });
  assert.ok(
    await film.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await filmContext.close();
  console.log(
    "Film: actual metadata, decoded playback, all eight chapter seeks, captions and narrow layout passed.",
  );
  const after = await status();
  assert.deepEqual(after.budget, before.budget);
  assert.equal(report.paidAttempts, 0);
  assert.deepEqual(report.errors, []);
  report.passed = true;
  await writeFile(
    new URL("sources.json", output),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    "Browser checks passed: desktop, phone, narrow phone, tablet, actual export/import, source invalidation, playback and reduced motion. No model calls.",
  );
} finally {
  await browser.close();
}
