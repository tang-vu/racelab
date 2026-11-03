import assert from "node:assert/strict";
import { chromium } from "playwright-core";
import { readFile, mkdir, writeFile } from "node:fs/promises";
const base = process.env.RACELAB_BASE_URL ?? "http://127.0.0.1:4174";
assert.ok(
  /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(base) ||
    (process.env.RACELAB_PUBLIC_CHECK === "1" &&
      new URL(base).protocol === "https:" &&
      new URL(base).origin === base),
  "Use a local preview or explicitly enable one HTTPS origin.",
);
const output = ".racelab/accessibility";
await mkdir(output, { recursive: true });
const axe = await readFile("node_modules/axe-core/axe.min.js", "utf8");
const report = {
  at: new Date().toISOString(),
  base,
  scans: [],
  keyboard: [],
  paidAttempts: 0,
  errors: [],
  passed: false,
  scope:
    "Edge keyboard interactions, axe and Chromium accessibility tree; no native screen-reader speech test",
};
const browser = await chromium.launch({ channel: "msedge", headless: true });
async function scan(page, name) {
  await page.evaluate(async () => {
    await Promise.all(
      document
        .getAnimations()
        .filter(
          (a) =>
            a.playState === "running" &&
            a.effect?.getComputedTiming().iterations !== Infinity,
        )
        .map((a) => a.finished.catch(() => {})),
    );
  });
  if (!(await page.evaluate(() => Boolean(window.axe))))
    await page.addScriptTag({ content: axe });
  const result = await page.evaluate(() =>
    axe.run(document, {
      runOnly: {
        type: "tag",
        values: [
          "wcag2a",
          "wcag2aa",
          "wcag21a",
          "wcag21aa",
          "wcag22aa",
          "best-practice",
        ],
      },
    }),
  );
  const entry = {
    name,
    violations: result.violations,
    incomplete: result.incomplete.map((x) => ({
      id: x.id,
      targets: x.nodes.map((n) => n.target),
    })),
  };
  report.scans.push(entry);
  console.log(`${name}: ${entry.violations.length} violations`);
}
async function settle(page) {
  await page.waitForFunction(() => !document.body.classList.contains("busy"));
}
async function tabTo(page, id, backwards = false) {
  for (let i = 0; i < 160; i++) {
    if (await page.evaluate((id) => document.activeElement?.id === id, id))
      return;
    await page.keyboard.press(backwards ? "Shift+Tab" : "Tab");
  }
  throw new Error(`Keyboard cannot reach ${id}`);
}
async function activate(page, id, backwards = false) {
  await tabTo(page, id, backwards);
  await page.keyboard.press("Enter");
  await settle(page);
}
async function tabs(page, a, b, panel) {
  await tabTo(page, b.slice(1), true);
  await page.keyboard.press("ArrowLeft");
  assert.equal(
    await page.locator(a).evaluate((e) => e === document.activeElement),
    true,
  );
  assert.equal(
    await page.locator(b).getAttribute("aria-selected"),
    "true",
    "Moving focus must not execute or select another tab",
  );
  await page.keyboard.press("Enter");
  await settle(page);
  await page.waitForFunction(
    (id) =>
      document.getElementById(id).getAttribute("aria-selected") === "true",
    a.slice(1),
  );
  assert.equal(
    await page.locator(panel).getAttribute("aria-labelledby"),
    a.slice(1),
  );
  await page.keyboard.press("End");
  assert.equal(
    await page.locator(b).evaluate((e) => e === document.activeElement),
    true,
  );
  await page.keyboard.press("Enter");
  await settle(page);
  await page.waitForFunction(
    (id) =>
      document.getElementById(id).getAttribute("aria-selected") === "true",
    b.slice(1),
  );
  await page.keyboard.press("Home");
  assert.equal(
    await page.locator(a).evaluate((e) => e === document.activeElement),
    true,
  );
  await page.keyboard.press("End");
  await page.keyboard.press("Tab");
  assert.equal(
    await page.evaluate(() => document.activeElement?.tagName),
    "TEXTAREA",
  );
  report.keyboard.push(
    `${panel}: manual arrows/Home/End/Enter, one tab stop, panel name and editor access`,
  );
}
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: "reduce",
    bypassCSP: true,
    acceptDownloads: true,
  });
  await context.route("**/*", (route) => {
    const url = new URL(route.request().url());
    const paid = /\/(agent|repair)$/.test(url.pathname);
    if (paid) report.paidAttempts++;
    return url.origin === base && !paid ? route.continue() : route.abort();
  });
  const page = await context.newPage();
  page.on("pageerror", (e) => report.errors.push(e.message));
  await page.goto(base + "/");
  await page.waitForFunction(
    () => document.querySelector("#stop-verdict")?.textContent === "FAIL",
  );
  await settle(page);
  await page.keyboard.press("Tab");
  assert.equal(
    await page
      .locator(".skip-link")
      .evaluate((e) => e === document.activeElement),
    true,
  );
  await page.keyboard.press("Enter");
  assert.equal(
    await page.evaluate(() => document.activeElement.id),
    "tend-lab",
  );
  report.keyboard.push("Skip link moves focus into the workbench");
  await tabTo(page, "project-name");
  await page.keyboard.press("Control+A");
  await page.keyboard.type("Keyboard verification");
  await activate(page, "project-save");
  assert.match(await page.locator("#project-note").textContent(), /saved/i);
  report.keyboard.push("Project naming and save by keyboard");
  await scan(page, "MVP original/light");
  await activate(page, "native-recorded");
  await page.waitForFunction(
    () =>
      document
        .querySelector("#native-candidate")
        .getAttribute("aria-selected") === "true",
  );
  await settle(page);
  assert.match(
    await page.locator("#native-verification").textContent(),
    /10 OF 10 CONDITIONS/,
  );
  assert.match(
    await page.locator("#native-result-status").textContent(),
    /Meta repair B: PASS/,
  );
  await scan(page, "MVP candidate/light");
  await tabs(page, "#native-original", "#native-candidate", "#native-editor");
  await page.waitForFunction(
    () => document.querySelector("#native-verdict").textContent === "PASS",
  );
  const cdp = await context.newCDPSession(page);
  const tree = await cdp.send("Accessibility.getFullAXTree");
  assert.ok(
    tree.nodes.some(
      (n) => n.role?.value === "tabpanel" && /Meta repair/.test(n.name?.value),
    ),
  );
  assert.ok(
    tree.nodes.some(
      (n) =>
        n.role?.value === "textbox" &&
        n.name?.value === "TypeScript claim method",
    ),
  );
  await writeFile(output + "/mvp-ax-tree.json", JSON.stringify(tree, null, 2));
  report.keyboard.push(
    "Accessible tree exposes named source tabs/panel/textbox and persistent result status",
  );
  await page.locator('[data-native-step="1"]').focus();
  await page.keyboard.press("Enter");
  assert.equal(
    await page.evaluate(() => document.activeElement.dataset.nativeStep),
    "1",
  );
  await page.keyboard.press("Tab");
  assert.equal(
    await page.evaluate(() => document.activeElement.dataset.nativeStep),
    "2",
  );
  report.keyboard.push(
    "Trace activation preserves focus for subsequent Tab navigation",
  );
  await activate(page, "native-import");
  const dialog = page.getByRole("dialog", { name: "Execute it again." });
  assert.equal(await dialog.isVisible(), true);
  await page.keyboard.press("Shift+Tab");
  assert.equal(
    await page.evaluate(() => document.activeElement.id),
    "native-import-confirm",
  );
  await page.keyboard.press("Tab");
  assert.equal(
    await page.evaluate(() => document.activeElement.id),
    "native-import-close",
  );
  await scan(page, "MVP import dialog");
  await tabTo(page, "native-import-json");
  await page.keyboard.type("{");
  await activate(page, "native-import-confirm");
  assert.notEqual(await page.locator("#native-import-error").textContent(), "");
  for (let i = 0; i < 7; i++) {
    await page.keyboard.press("Tab");
    assert.equal(
      await page.evaluate(() => document.activeElement.closest("dialog")?.id),
      "native-import-dialog",
    );
  }
  await page.keyboard.press("Escape");
  assert.equal(await dialog.isVisible(), false);
  assert.equal(
    await page.evaluate(() => document.activeElement.id),
    "native-import",
  );
  report.keyboard.push(
    "Named import dialog: Tab containment, visible in-dialog error, Escape and focus return",
  );
  await activate(page, "theme-toggle");
  await scan(page, "MVP candidate/dark");
  await page.setViewportSize({ width: 320, height: 844 });
  assert.ok(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await page.screenshot({
    path: output + "/mvp-320.png",
    animations: "disabled",
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  for (const path of [
    "/store",
    "/evidence.html",
    "/film.html",
    "/evaluation.html",
  ]) {
    await page.goto(base + path);
    await settle(page);
    await page.evaluate(() => document.fonts.ready);
    if (path === "/evidence.html")
      await page
        .getByRole("status")
        .filter({ hasText: "Recording integrity verified" })
        .waitFor();
    for (const theme of ["light", "dark"]) {
      if ((await page.locator("html").getAttribute("data-theme")) !== theme)
        await activate(page, "theme-toggle");
      await scan(page, path + "/" + theme);
    }
    if (path === "/store") {
      await activate(page, "recorded-button");
      await tabs(page, "#original-tab", "#candidate-tab", "#store-editor");
      await scan(page, "Store candidate/dark");
      await page.locator('[data-step="1"]').focus();
      await page.keyboard.press("Enter");
      assert.equal(
        await page.evaluate(() => document.activeElement.dataset.step),
        "1",
      );
    }
    if (path === "/evidence.html") {
      await tabTo(page, "version-a", true);
      await page.keyboard.press("ArrowRight");
      await page.keyboard.press("Enter");
      assert.equal(
        await page.locator("#version-b").getAttribute("aria-selected"),
        "true",
      );
      assert.equal(
        await page
          .locator("#evidence-source-panel")
          .getAttribute("aria-labelledby"),
        "version-b",
      );
      report.keyboard.push(
        "Recorded explorer A/B keyboard activation and panel labeling",
      );
    }
  }
  await context.close();
  assert.equal(report.paidAttempts, 0);
  assert.deepEqual(report.errors, []);
  assert.equal(
    report.scans.reduce((n, x) => n + x.violations.length, 0),
    0,
    "Accessibility violations remain; see the saved report",
  );
  report.passed = true;
} finally {
  await browser.close();
  await writeFile(
    output + "/review.json",
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log(
    JSON.stringify({
      passed: report.passed,
      scans: report.scans.length,
      keyboard: report.keyboard,
      paidAttempts: report.paidAttempts,
      errors: report.errors,
    }),
  );
}
