import { frameFor, eventText } from "./tend-view.js";
import { renderInvestigation } from "./investigation-view.js";

export const RECORDING_HASH =
  "91e2b1ffc0d4ac3940d537b5a7552f15977905743a3480eadfcc8b090480baee";
const $ = (id) => document.getElementById(id);
const state = {
  report: null,
  version: "a",
  condition: "crash-restart",
  run: null,
  step: 0,
  timer: null,
};
function stop() {
  clearInterval(state.timer);
  state.timer = null;
  $("evidence-play").textContent = "Play trace";
}
function render() {
  const frame = frameFor(state.run, state.step);
  $("evidence-verdict").textContent = frame?.verdict ?? "NOT RECORDED";
  $("evidence-verdict").className =
    `badge ${frame?.verdict === "PASS" ? "pass" : frame?.verdict === "FAIL" || frame?.verdict === "ERROR" ? "fail" : "neutral"}`;
  if (!frame) return;
  $("evidence-scrubber").value = frame.step;
  $("evidence-step").textContent = `${frame.step} / ${frame.total}`;
  $("evidence-event").textContent = frame.event
    ? eventText(frame.event)
    : "Initial committed fixture. No worker started.";
  $("evidence-rows").textContent = JSON.stringify(frame.rows, null, 2);
  $("evidence-processes").textContent =
    Object.entries(frame.processes)
      .map(
        ([name, p]) =>
          `${name}: PID ${p.pid} · ${p.status} · generation ${p.claim?.attemptCount ?? "—"}`,
      )
      .join(" | ") || "Workers: not started";
}
function choose() {
  stop();
  const r = state.report;
  const originals = [r.baseline, ...r.probes.map((p) => p.run)];
  state.run =
    state.version === "a"
      ? originals.find((run) => run?.condition === state.condition)
      : r.best?.verification.cases.find((c) => c.id === state.condition)?.run;
  $("version-a").setAttribute("aria-selected", String(state.version === "a"));
  $("version-b").setAttribute("aria-selected", String(state.version === "b"));
  $("evidence-condition").value = state.condition;
  for (const b of $("evidence-matrix").children)
    b.setAttribute(
      "aria-pressed",
      String(b.dataset.condition === state.condition),
    );
  $("evidence-source-title").textContent =
    state.version === "a" ? "Pinned method / A" : "Meta candidate / B";
  $("evidence-source").textContent =
    state.version === "a" ? r.startingSource : r.best.source;
  $("evidence-run-title").textContent =
    state.run?.title ?? "Original run not retained";
  $("evidence-playback").hidden = !state.run;
  $("evidence-missing").hidden = Boolean(state.run);
  $("evidence-missing").textContent =
    "This condition was not recorded for the original method. Select the Meta candidate to inspect its saved execution, or run the original locally.";
  $("evidence-checks").replaceChildren();
  $("evidence-trace").replaceChildren();
  if (state.run) {
    state.step = state.run.trace.length;
    $("evidence-scrubber").max = state.step;
    for (const check of state.run.verdict.checks) {
      const details = document.createElement("details"),
        summary = document.createElement("summary"),
        pre = document.createElement("pre");
      details.classList.toggle("failed", !check.passed);
      summary.textContent = `${check.passed ? "PASS" : "FAIL"} · ${check.name}`;
      pre.textContent = `Actual: ${JSON.stringify(check.actual, null, 2)}\nExpected: ${JSON.stringify(check.expected, null, 2)}`;
      details.append(summary, pre);
      $("evidence-checks").append(details);
    }
    for (const event of state.run.trace) {
      const li = document.createElement("li");
      li.textContent = eventText(event);
      $("evidence-trace").append(li);
    }
  } else {
    state.step = 0;
    $("evidence-checks").textContent =
      "No original execution was retained for this condition.";
  }
  render();
}
for (const v of ["a", "b"])
  $("version-" + v).addEventListener("click", () => {
    if (!state.report) return;
    state.version = v;
    choose();
  });
$("evidence-condition").addEventListener("change", (e) => {
  state.condition = e.target.value;
  choose();
});
$("evidence-scrubber").addEventListener("input", (e) => {
  stop();
  state.step = Number(e.target.value);
  render();
});
for (const [name, change] of Object.entries({
  start: () => 0,
  back: (n) => Math.max(0, n - 1),
  next: (n) => Math.min(state.run.trace.length, n + 1),
  end: () => state.run.trace.length,
}))
  $("evidence-" + name).addEventListener("click", () => {
    if (!state.run) return;
    stop();
    state.step = change(state.step);
    render();
  });
$("evidence-play").addEventListener("click", () => {
  if (state.timer) return stop();
  if (!state.run) return;
  if (state.step === state.run.trace.length) state.step = 0;
  $("evidence-play").textContent = "Pause trace";
  render();
  state.timer = setInterval(() => {
    state.step++;
    render();
    if (state.step >= state.run.trace.length) stop();
  }, 650);
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) stop();
});
window.addEventListener("pagehide", stop);
try {
  const response = await fetch("/recordings/tend-claims.json");
  if (!response.ok)
    throw new Error(`Recording download failed (${response.status}).`);
  const bytes = await response.arrayBuffer();
  const digest = [
    ...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
  ]
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
  if (digest !== RECORDING_HASH)
    throw new Error("Recording integrity failed. Evidence was not opened.");
  state.report = JSON.parse(new TextDecoder().decode(bytes));
  const r = state.report;
  for (const c of r.best.verification.cases) {
    const option = document.createElement("option");
    option.value = c.id;
    option.textContent = c.title;
    $("evidence-condition").append(option);
    const button = document.createElement("button"),
      label = document.createElement("span"),
      verdict = document.createElement("strong");
    label.textContent = c.title;
    verdict.textContent = `B / ${c.passed ? "PASS" : "FAIL"}`;
    button.dataset.condition = c.id;
    button.append(label, verdict);
    button.addEventListener("click", () => {
      state.condition = c.id;
      state.version = "b";
      choose();
    });
    $("evidence-matrix").append(button);
  }
  renderInvestigation($("evidence-investigation"), r, { recorded: true });
  $("evidence-facts").textContent =
    `${r.model} · ${r.requests} retained requests · $${r.costUsd.toFixed(6)} actual study cost · ${r.patches.length} candidate. One retained investigation; no general repair-rate claim.`;
  $("evidence-hash").textContent = `Recording SHA-256 ${digest}`;
  $("evidence-status").textContent =
    "Recording integrity verified. No new execution or model calls.";
  choose();
} catch (error) {
  $("evidence-status").textContent = error.message;
  for (const b of document.querySelectorAll(
    ".explorer-workbench button,.explorer-workbench input,.explorer-workbench select",
  ))
    b.disabled = true;
}
