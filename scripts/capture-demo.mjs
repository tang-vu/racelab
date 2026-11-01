import { chromium } from "playwright-core";
import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { resolve, join } from "node:path";
const base = "http://127.0.0.1:4174",
  out = resolve(".racelab/film-evidence"),
  published = resolve("docs/evidence-shots"),
  bin = "D:/Apps/FFmpeg-9.0.2/bin";
await mkdir(out, { recursive: true });
await mkdir(published, { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
const registry = {
  format: "racelab-browser-capture-v2",
  browser: await browser.version(),
  capturedAt: new Date().toISOString(),
  viewport: { width: 1440, height: 700 },
  sources: {},
  paidAttempts: 0,
  errors: [],
  passed: false,
};
if (process.argv.includes("--resume")) {
  const previous = JSON.parse(await readFile(join(out, "sources.json")));
  registry.sources = previous.sources;
  const refresh = process.argv
    .find((arg) => arg.startsWith("--refresh="))
    ?.slice(10);
  if (refresh) for (const id of refresh.split(",")) delete registry.sources[id];
}
const sha = async (path) =>
  createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
const delay = (ms) => new Promise((done) => setTimeout(done, ms));
const scroll = async (page, selector) =>
  page
    .locator(selector)
    .first()
    .evaluate((el) =>
      scrollTo({
        top: el.getBoundingClientRect().top + scrollY - 96,
        behavior: "instant",
      }),
    );
const ready = async (page, url) => {
  await page.goto(base + url);
  await page.evaluate(() => document.fonts.ready);
  if (url === "/evidence.html")
    await page
      .getByText("Recording integrity verified.", { exact: false })
      .waitFor();
  if (url === "/evaluation.html")
    await page
      .getByText("Saved evaluation artifacts loaded.", { exact: false })
      .waitFor();
};
async function context(video = false) {
  const c = await browser.newContext({
    viewport: registry.viewport,
    deviceScaleFactor: 1,
    ...(video
      ? { recordVideo: { dir: join(out, "raw"), size: registry.viewport } }
      : {}),
  });
  await c.route("**/*", (route) => {
    const u = new URL(route.request().url());
    if (u.pathname.endsWith("/agent")) registry.paidAttempts++;
    return u.origin === base && !u.pathname.endsWith("/agent")
      ? route.continue()
      : route.abort();
  });
  return c;
}
async function movie(id, seconds, prepare, actions) {
  if (registry.sources[id]) return;
  const c = await context(true),
    openedAt = Date.now(),
    p = await c.newPage();
  p.on("pageerror", (e) => registry.errors.push(e.message));
  await prepare(p);
  const started = Date.now();
  await actions(p);
  await delay(Math.max(0, seconds * 1000 - (Date.now() - started)));
  await c.close();
  const raw = await p.video().path(),
    meta = JSON.parse(
      execFileSync(
        join(bin, "ffprobe.exe"),
        ["-v", "error", "-show_format", "-of", "json", raw],
        { encoding: "utf8", windowsHide: true },
      ),
    );
  // Context shutdown can append several seconds of final frames. Do not derive
  // the start from total duration: that can trim away the original failure.
  const offset = Math.max(0, (started - openedAt) / 1000 - 0.15);
  const name = id + ".webm",
    file = join(out, name);
  execFileSync(
    join(bin, "ffmpeg.exe"),
    [
      "-v",
      "error",
      "-y",
      "-ss",
      String(offset),
      "-i",
      raw,
      "-t",
      String(seconds),
      "-vf",
      "fps=30,tpad=stop_mode=clone:stop_duration=1",
      "-c:v",
      "libvpx-vp9",
      "-cpu-used",
      "4",
      "-row-mt",
      "1",
      "-crf",
      "28",
      "-b:v",
      "0",
      file,
    ],
    { windowsHide: true, timeout: 60000 },
  );
  await copyFile(file, join(published, name));
  registry.sources[id] = {
    type: "app-recording",
    method:
      "Playwright video / fresh Microsoft Edge context / actual UI interactions; trimmed preparation, 30 fps conversion",
    url: base + (id === "08-explore" ? "/evidence.html" : "/evidence.html"),
    viewport: registry.viewport,
    sha256: await sha(file),
    rawSha256: await sha(raw),
    trimStartSeconds: offset,
    rawDurationSeconds: Number(meta.format.duration),
    recordedSeconds: seconds,
  };
  console.log("Recorded " + id);
}
async function still(id, url, selector) {
  if (registry.sources[id]) return;
  const c = await context(),
    p = await c.newPage();
  p.on("pageerror", (e) => registry.errors.push(e.message));
  await ready(p, url);
  await scroll(p, selector);
  const file = join(out, id + ".png");
  await p.screenshot({ path: file, animations: "disabled" });
  await copyFile(file, join(published, id + ".png"));
  registry.sources[id] = {
    type: "app-screenshot",
    method:
      "Playwright / fresh Microsoft Edge context / actual local application",
    url: base + url,
    viewport: registry.viewport,
    sha256: await sha(file),
  };
  await c.close();
  console.log("Captured " + id);
}
try {
  await movie(
    "01-result",
    20,
    async (p) => {
      await ready(p, "/evidence.html");
      await scroll(p, ".explorer-toolbar");
    },
    async (p) => {
      await delay(4500);
      await p.locator("#version-b").click();
      await delay(5000);
      await p.locator("#evidence-condition").selectOption("expired-owner");
      await delay(4000);
      await p.locator("#evidence-condition").selectOption("crash-restart");
    },
  );
  await still("02-source", "/tend.html", "#tend-lab");
  await movie(
    "03-process",
    24,
    async (p) => {
      await ready(p, "/evidence.html");
      await p.locator("#evidence-start").click();
      await scroll(p, ".explorer-grid");
    },
    async (p) => {
      await p.locator("#evidence-play").click();
      await delay(15000);
      await p.locator("#evidence-end").click();
      await delay(4000);
      await p.locator("#version-b").click();
    },
  );
  await movie(
    "04-investigation",
    25,
    async (p) => {
      await ready(p, "/evidence.html");
      await scroll(p, "#evidence-investigation");
    },
    async (p) => {
      await p
        .locator("#evidence-investigation details")
        .first()
        .locator("summary")
        .click();
      await delay(7000);
      await p
        .locator("#evidence-investigation details")
        .first()
        .locator("summary")
        .click();
      await p
        .locator("#evidence-investigation details")
        .nth(1)
        .locator("summary")
        .click();
      await delay(6500);
      await scroll(p, "#evidence-investigation details:nth-of-type(2) pre");
    },
  );
  await still("05-lifecycle", "/evaluation.html", "#lifecycle-results");
  await still("06-repositories", "/evaluation.html", "#repository-results");
  await still("07-comparison", "/evaluation.html", "#comparison-results");
  await movie(
    "08-explore",
    20,
    async (p) => {
      await ready(p, "/evidence.html");
      await p.locator("#version-b").click();
      await scroll(p, ".explorer-toolbar");
    },
    async (p) => {
      await p.locator("#evidence-condition").selectOption("lease-edge");
      await delay(5000);
      await p.locator("#evidence-start").click();
      await p.locator("#evidence-next").click();
      await delay(3500);
      await p.locator("#evidence-end").click();
      await delay(3500);
      await scroll(p, ".explorer-provenance");
    },
  );
  if (registry.paidAttempts || registry.errors.length)
    throw Error("Capture had browser errors or paid endpoint attempts.");
  registry.passed = true;
} finally {
  await browser.close();
  await writeFile(
    join(out, "sources.json"),
    JSON.stringify(registry, null, 2) + "\n",
  );
  await copyFile(join(out, "sources.json"), join(published, "sources.json"));
}
