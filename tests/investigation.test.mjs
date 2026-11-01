import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { JSDOM } from "jsdom";
import {
  investigationEntries,
  renderInvestigation,
} from "../public/investigation-view.js";

test("retained hypotheses and failed feedback stay visible without inventing a transcript", async () => {
  const r = JSON.parse(
    await readFile(
      new URL("../public/recordings/tend-claims.json", import.meta.url),
    ),
  );
  const dom = new JSDOM("<main></main>");
  const node = dom.window.document.querySelector("main");
  renderInvestigation(node, r, { recorded: true });
  assert.equal(investigationEntries(r).length, 2);
  assert.match(node.textContent, /probe_recovery/);
  assert.match(node.textContent, /"passed": false/);
  assert.match(node.textContent, /complete raw model transcript/);
  assert.equal(node.querySelectorAll("details").length, 2);
  dom.window.close();
});
test("imported attribution and hostile fields render as text; missing attempts remain missing", () => {
  const dom = new JSDOM("<main></main>"),
    node = dom.window.document.querySelector("main");
  const attack = '<img src=x onerror="window.hacked=true">';
  renderInvestigation(node, {
    model: "Imported candidate / attribution unverified",
    probes: [null, { hypothesis: attack }],
    patches: [null, {}],
    reasoning: "PRIVATE NEVER DISPLAY",
  });
  assert.match(node.textContent, /attribution unverified/);
  assert.ok(node.textContent.includes(attack));
  assert.equal(node.querySelector("img"), null);
  assert.ok(!node.textContent.includes("PRIVATE NEVER DISPLAY"));
  assert.match(node.textContent, /not retained/);
  renderInvestigation(node, { probes: {}, patches: false });
  assert.match(node.textContent, /No probe or candidate attempts/);
  renderInvestigation(node, null);
  assert.equal(node.childElementCount, 0);
  dom.window.close();
});
