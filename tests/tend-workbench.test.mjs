import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { mkdtemp, rm, readFile, mkdir, copyFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM, VirtualConsole } from "jsdom";
import { TEND } from "../src/workloads/tend-source.mjs";
import * as evidence from "../public/evidence-view.js";
import * as view from "../public/tend-view.js";
import * as investigation from "../public/investigation-view.js";
import * as motionData from "../public/motion-data.js";
import * as project from "../public/method-project.js";
const root = fileURLToPath(new URL("../", import.meta.url));
const sourcePath = join(root, `.racelab/sources/tend-${TEND.commit}.ts`);
let prepared = true;
try {
  await readFile(sourcePath);
} catch {
  prepared = false;
}
async function until(check) {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > 25_000)
      throw new Error("Repository UI did not settle.");
    await new Promise((done) => setTimeout(done, 20));
  }
}
test(
  "Repository workbench re-executes TEND, inspects A/B and recomputes an imported regression with no paid calls",
  { skip: !prepared && "Run npm run prepare:tend once." },
  async (t) => {
    const directory = await mkdtemp(join(tmpdir(), "racelab-native-ui-"));
    await mkdir(join(directory, "sources"));
    await copyFile(
      sourcePath,
      join(directory, "sources", `tend-${TEND.commit}.ts`),
    );
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
      windowsHide: true,
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
    const base = `http://127.0.0.1:${port}`,
      errors = [];
    const console = new VirtualConsole();
    console.on("jsdomError", (error) => errors.push(error.message));
    dom = new JSDOM(await (await fetch(base + "/")).text(), {
      url: base + "/",
      runScripts: "outside-only",
      pretendToBeVisual: true,
      virtualConsole: console,
    });
    const { window } = dom,
      $ = (id) => window.document.getElementById(id);
    let paid = 0;
    window.fetch = (path, init) => {
      if (path.endsWith("/agent")) {
        paid++;
        throw new Error("Paid calls forbidden in UI test");
      }
      return fetch(new URL(path, base), init);
    };
    window.TextDecoder = TextDecoder;
    window.__evidence = evidence;
    window.__view = view;
    window.__investigation = investigation;
    window.__motionData = motionData;
    window.__project = project;
    window.matchMedia = () => ({ matches: false, addEventListener() {} });
    const downloads = [];
    window.Blob = Blob;
    window.URL.createObjectURL = (blob) => {
      downloads.push(blob);
      return "blob:local-test";
    };
    window.URL.revokeObjectURL = () => {};
    window.HTMLAnchorElement.prototype.click = function () {};
    window.Element.prototype.scrollIntoView = () => {};
    window.HTMLDialogElement.prototype.showModal = function () {
      this.open = true;
    };
    window.HTMLDialogElement.prototype.close = function () {
      this.open = false;
    };
    window.addEventListener("error", (event) => errors.push(event.message));
    const experience = (
      await readFile(join(root, "public/experience.js"), "utf8")
    ).replace(/^import[^\n]*\r?\n/gm, "");
    window.eval(
      `(()=>{const{chapterSteps,replayFrame}=window.__motionData;\n${experience}\n})()`,
    );
    const script = (
      await readFile(join(root, "public/tend.js"), "utf8")
    ).replace(/^import[\s\S]*?from\s+"[^"\n]+";\r?\n/gm, "");
    await window.eval(
      `(async()=>{const{highlightSource}=window.__evidence;const{frameFor,eventText,methodDiff}=window.__view;const{renderInvestigation}=window.__investigation;const{extractClaimMethod,blankMethod,PROJECT_KEY}=window.__project;\n${script}\n})()`,
    );
    const click = async (id) => {
      assert.equal($(id).disabled, false, id + " available");
      $(id).click();
      await until(() => !window.document.body.classList.contains("busy"));
    };
    assert.match($("source-proof").textContent, /SOURCE VERIFIED/);
    assert.equal($("normal-verdict").textContent, "PASS");
    assert.equal($("stop-verdict").textContent, "FAIL");
    assert.equal($("native-actual").textContent, "0");
    assert.equal($("native-agent").disabled, true);
    assert.equal($("worker-a-status").textContent, "terminated");
    await click("native-recorded");
    assert.equal($("native-source").readOnly, true);
    assert.equal($("native-verdict").textContent, "PASS");
    assert.equal($("native-actual").textContent, "1");
    assert.match($("native-verification").textContent, /10 OF 10 CONDITIONS/);
    assert.equal($("native-diff").disabled, false);
    assert.equal($("native-export").disabled, false);
    await click("native-export");
    const exported = await downloads.at(-1).text();
    assert.equal(JSON.parse(exported).recomputed, true);
    await click("native-diff");
    assert.match(await downloads.at(-1).text(), /completeFollowUp\(/);
    await click("theme-toggle");
    assert.equal(window.document.documentElement.dataset.theme, "dark");
    const stale = window.document.querySelector(
      '[data-native-condition="expired-owner"]',
    );
    stale.click();
    assert.match($("native-trace").textContent, /completion rejected/);
    await click("native-original");
    assert.equal($("native-source").readOnly, false);
    const original = $("native-source").value;
    $("native-source").value =
      original + '\n// <img src=x onerror="window.injected=true">';
    $("native-source").dispatchEvent(new window.Event("input"));
    assert.equal($("native-export").disabled, true);
    assert.equal($("native-candidate").disabled, true);
    assert.equal(window.document.querySelector(".code-surface img"), null);
    assert.equal(window.injected, undefined);
    await click("native-recorded");
    assert.match($("native-status").textContent, /Reset your edits/);
    await click("native-reset");
    assert.equal($("native-source").value, original);
    await click("native-import");
    $("native-import-json").value = exported;
    await click("native-import-confirm");
    assert.equal($("native-import-dialog").open, false);
    assert.match(
      $("native-verification").textContent,
      /attribution unverified/,
    );
    $("native-scrubber").value = "0";
    $("native-scrubber").dispatchEvent(new window.Event("input"));
    assert.equal($("native-actual").textContent, "0");
    assert.equal($("worker-a-status").textContent, "Not started");
    await click("native-play");
    await until(() => Number($("native-scrubber").value) > 0);
    await click("native-play");
    const bad = await fetch(base + "/api/workloads/tend/execute", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://untrusted.example",
      },
      body: JSON.stringify({ action: "run" }),
    });
    assert.equal(bad.status, 403);
    assert.equal(paid, 0);
    assert.equal(
      (await (await fetch(base + "/api/status")).json()).budget.requests,
      0,
    );
    assert.deepEqual(errors, []);
  },
);
