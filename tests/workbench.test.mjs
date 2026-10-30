// DOM behavior tests exercise the actual frontend against a keyless local server.
// jsdom does not paint CSS; these tests do not constitute visual browser QA.
import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM, VirtualConsole } from "jsdom";
import * as presentation from "../public/evidence-view.js";
import * as motionData from "../public/motion-data.js";

const root = fileURLToPath(new URL("../", import.meta.url));
async function until(check) {
  const started = Date.now();
  while (!check()) {
    if (Date.now() - started > 15000)
      throw new Error("UI state did not settle.");
    await new Promise((done) => setTimeout(done, 15));
  }
}

test("The actual workbench walks from overlap to inspected repair and recomputed import without paid calls", async (t) => {
  const directory = await mkdtemp(join(tmpdir(), "racelab-dom-"));
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
  let dom;
  t.after(async () => {
    dom?.window.close();
    if (child.exitCode === null) {
      const exited = once(child, "exit");
      child.kill();
      await exited;
    }
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + sep));
    await rm(directory, { recursive: true, force: true });
  });
  await once(child.stdout, "data", { signal: AbortSignal.timeout(15000) });
  const base = `http://127.0.0.1:${port}`;
  const html = await (await fetch(base)).text();
  const errors = [];
  const console = new VirtualConsole();
  console.on("jsdomError", (error) => errors.push(error.message));
  dom = new JSDOM(html, {
    url: base,
    runScripts: "outside-only",
    pretendToBeVisual: true,
    virtualConsole: console,
  });
  const { window } = dom;
  const $ = (id) => window.document.getElementById(id);
  let attemptedPaid = 0;
  window.fetch = (path, init) => {
    if (path === "/api/racelab/agent") {
      attemptedPaid++;
      throw new Error("Paid calls are forbidden in UI tests.");
    }
    return fetch(new URL(path, base), init);
  };
  window.TextDecoder = TextDecoder;
  window.__presentation = presentation;
  window.__motionData = motionData;
  const mediaListeners = [];
  let reduceMotion = false;
  window.matchMedia = (query) => ({
    get matches() {
      return query.includes("reduced-motion") && reduceMotion;
    },
    addEventListener(_, listener) {
      mediaListeners.push(listener);
    },
  });
  window.Element.prototype.scrollIntoView = () => {};
  window.Element.prototype.scrollBy = () => {};
  window.HTMLDialogElement.prototype.showModal = function () {
    this.open = true;
  };
  window.HTMLDialogElement.prototype.close = function () {
    this.open = false;
  };
  window.addEventListener("error", (event) => errors.push(event.message));
  const experience = (
    await readFile(join(root, "public/experience.js"), "utf8")
  ).replace(/^import[\s\S]*?from "\.\/motion-data\.js";\r?\n/, "");
  window.eval(
    `(() => {const {chapterSteps,replayFrame}=window.__motionData;\n${experience}\n})()`,
  );
  const frontend = (
    await readFile(join(root, "public/racelab.js"), "utf8")
  ).replace(/^import[\s\S]*?from "\.\/evidence-view\.js";\r?\n/, "");
  await window.eval(
    `(async () => {const {highlightSource,collisionPair,impactFor}=window.__presentation;\n${frontend}\n})()`,
  );
  async function click(id) {
    assert.equal($(id).disabled, false, `${id} is available`);
    $(id).click();
    await until(() => !window.document.body.classList.contains("busy"));
  }
  assert.equal($("serial-verdict").textContent, "PASS");
  assert.equal($("race-verdict").textContent, "FAIL");
  assert.equal($("impact-actual").textContent, "2");
  assert.equal($("impact-expected").textContent, "1");
  assert.equal(
    $("sculpture-outcome").textContent,
    "2 / 1 committed / available seats",
  );
  assert.equal($("sculpture-read-a").textContent, "1");
  assert.equal($("sculpture-read-b").textContent, "1");
  const sourceBeforeTheme = $("source").value;
  await click("theme-toggle");
  assert.equal(window.document.documentElement.dataset.theme, "dark");
  assert.equal(window.localStorage.getItem("racelab-theme"), "dark");
  await click("motion-toggle");
  assert.equal(window.document.body.classList.contains("motion-paused"), true);
  await click("motion-toggle");
  assert.equal(window.document.body.classList.contains("motion-paused"), false);
  reduceMotion = true;
  mediaListeners.forEach((listener) => listener());
  assert.equal($("motion-toggle").disabled, true);
  assert.equal(window.document.body.classList.contains("motion-paused"), true);
  assert.equal($("source").value, sourceBeforeTheme);
  // Scroll selects another real frame without executing another API request.
  const chapters = [...window.document.querySelectorAll(".story-chapter")];
  chapters.forEach(
    (chapter, i) =>
      (chapter.getBoundingClientRect = () => ({
        top: i === 2 ? window.innerHeight / 2 - 50 : -2000,
        height: 100,
      })),
  );
  window.dispatchEvent(new window.Event("scroll"));
  await until(() => $("story-verdict").textContent === "FAIL");
  assert.equal($("story-actual").textContent, "2");
  assert.equal($("story-version").textContent, "ORIGINAL A");
  assert.equal($("agent-button").disabled, true);
  await click("collision-button");
  assert.equal($("scrubber").value, "2");
  assert.equal($("impact-actual").textContent, "0");
  assert.match(
    $("observation-text").textContent,
    /Two requests read stock = 1/,
  );
  await click("serial-button");
  assert.equal($("run-badge").textContent, "PASS");
  assert.equal($("impact-actual").textContent, "1");
  await click("race-button");
  assert.equal($("run-badge").textContent, "FAIL");
  await click("recorded-button");
  assert.equal($("verification").hidden, false);
  assert.match($("verification").textContent, /11 schedules \/ 4 input cases/);
  assert.equal($("inspect-candidate").hidden, false);
  await click("inspect-candidate");
  assert.equal($("source").readOnly, true);
  assert.equal($("run-badge").textContent, "PASS");
  assert.equal($("impact-actual").textContent, "1");
  assert.equal($("collision-button").disabled, true);
  assert.equal($("story-version").textContent, "CANDIDATE B");
  assert.equal($("story-verdict").textContent, "PASS");
  assert.equal($("story-actual").textContent, "1");
  await click("original-tab");
  assert.equal($("source").readOnly, false);
  const original = $("source").value;
  $("source").value =
    original + '\n// <img src=x onerror="window.injected=true">';
  $("source").dispatchEvent(new window.Event("input", { bubbles: true }));
  assert.equal($("export-button").disabled, true);
  assert.equal($("verification").hidden, true);
  assert.equal($("candidate-tab").disabled, true);
  assert.equal($("story-verdict").textContent, "WAITING");
  assert.equal($("sculpture-value").textContent, "—");
  assert.equal(window.document.querySelector(".code-surface img"), null);
  assert.equal(window.injected, undefined);
  await click("recorded-button");
  assert.match(
    $("status").textContent,
    /saved repair belongs to the authored source/,
  );
  assert.match($("source").value, /window.injected/);
  await click("reset-source");
  assert.equal($("source").value, original);
  await click("import-button");
  assert.equal($("import-dialog").open, true);
  $("import-json").value = await readFile(
    join(root, "public/recordings/last-seat.json"),
    "utf8",
  );
  await click("import-confirm");
  assert.equal($("import-dialog").open, false);
  assert.match(
    $("verification").textContent,
    /Imported candidate \/ attribution unverified/,
  );
  assert.equal($("export-button").disabled, false);
  const cases = $("case-list").querySelectorAll("button");
  cases[1].click();
  await until(() => !window.document.body.classList.contains("busy"));
  assert.match($("experiment-headline").textContent, /one event/i);
  assert.equal($("impact-actual").textContent, "2");
  assert.equal($("verification").hidden, true);
  $("case-list").querySelector('[data-case="lost-update"]').click();
  await until(() => !window.document.body.classList.contains("busy"));
  assert.equal($("impact-actual").textContent, "15");
  assert.equal($("impact-expected").textContent, "18");
  await click("play-button");
  await until(() => Number($("scrubber").value) > 0);
  assert.ok(Number($("scrubber").value) < 6);
  await click("play-button");
  await click("focus-button");
  assert.equal(window.document.body.classList.contains("focus-mode"), true);
  window.document.dispatchEvent(
    new window.KeyboardEvent("keydown", { key: "Escape" }),
  );
  assert.equal(window.document.body.classList.contains("focus-mode"), false);
  assert.equal(attemptedPaid, 0);
  assert.equal(
    (await (await fetch(base + "/api/status")).json()).budget.requests,
    0,
  );
  assert.deepEqual(errors, []);
});
