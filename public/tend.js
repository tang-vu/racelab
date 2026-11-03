import { highlightSource } from "./evidence-view.js";
import { frameFor, eventText, methodDiff } from "./tend-view.js";
import { renderInvestigation } from "./investigation-view.js";
import {
  extractClaimMethod,
  blankMethod,
  PROJECT_KEY,
} from "./method-project.js";

const $ = (id) => document.getElementById(id);
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
const state = {
  input: null,
  source: "",
  version: "original",
  run: null,
  report: null,
  step: 0,
  busy: false,
  configured: false,
  live: null,
  recorded: false,
  original: new Map(),
  playing: null,
};
async function api(path, body) {
  const response = await fetch(
    path,
    body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : undefined,
  );
  if (!response.headers.get("Content-Type")?.includes("application/json"))
    throw new Error(
      `The runner is temporarily unavailable (HTTP ${response.status}). Try the check again; your source is still here.`,
    );
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error ?? "The experiment could not finish.");
  return result;
}
function status(message, error = false) {
  $("native-status").textContent = message;
  $("native-status").classList.toggle("error", error);
  $("native-status").hidden = !message;
  $("native-import-error").textContent =
    error && $("native-import-dialog").open ? message : "";
}
function controls() {
  const disabled = state.busy || !state.input;
  for (const id of [
    "native-run",
    "native-reset",
    "native-original",
    "native-import",
  ])
    $(id).disabled = disabled;
  $("native-condition").disabled = disabled;
  $("native-candidate").disabled = disabled || !state.report?.best;
  $("native-recorded").disabled = disabled || !state.recorded;
  $("native-agent").disabled = disabled || !state.configured;
  $("project-live").disabled = disabled || !state.configured;
  $("native-export").disabled = disabled || !state.report;
  $("native-diff").disabled = disabled || !state.report?.best;
  $("native-play").disabled = disabled || !state.run?.trace.length;
  $("native-scrubber").disabled = disabled || !state.run;
  $("native-source").readOnly = state.busy || state.version === "candidate";
  for (const id of [
    "project-new",
    "project-file",
    "project-save",
    "project-list",
    "project-draft",
    "project-recover",
  ])
    $(id).disabled = disabled;
}
async function perform(message, action) {
  if (state.busy) return;
  const focused = document.activeElement;
  $("native-result-status").textContent = "";
  stopPlayback();
  state.busy = true;
  document.body.classList.add("busy");
  controls();
  status(message);
  try {
    await action();
    status("");
    const checks = state.run?.verdict.checks ?? [];
    $("native-result-status").textContent = checks.length
      ? `${state.version === "candidate" ? "Meta repair B" : "Original A"}: ${state.run.verdict.passed ? "PASS" : "FAIL"}. ${checks.filter((item) => item.passed).length} of ${checks.length} execution checks passed.`
      : "Action completed.";
  } catch (error) {
    status(error.message, true);
  } finally {
    state.busy = false;
    document.body.classList.remove("busy");
    controls();
    if (
      document.activeElement === document.body &&
      focused?.isConnected &&
      !focused.disabled
    )
      focused.focus({ preventScroll: true });
  }
}
function code() {
  const source =
    state.version === "candidate"
      ? (state.report?.best?.source ?? "")
      : state.source;
  $("native-source").value = source;
  $("native-highlight").innerHTML = highlightSource(source);
  $("native-lines").textContent = source
    .split("\n")
    .map((_, i) => i + 1)
    .join("\n");
  $("native-original").setAttribute(
    "aria-selected",
    String(state.version === "original"),
  );
  $("native-candidate").setAttribute(
    "aria-selected",
    String(state.version === "candidate"),
  );
  $("native-source-label").textContent =
    state.version === "candidate"
      ? "Read-only candidate / B"
      : state.source === state.input?.source
        ? "Verified repository input / A"
        : "Your method / A";
  $("native-source-hash").textContent =
    state.version === "candidate"
      ? state.report?.best.sourceHash.slice(0, 12)
      : state.source === state.input?.source
        ? state.input.sourceHash.slice(0, 12)
        : "CHANGED";
  controls();
}
function checks() {
  const items = state.run?.verdict.checks ?? [];
  $("native-checks").innerHTML = items.length
    ? `<p class="section-kicker">FULL EXECUTION / ${items.filter((item) => item.passed).length} OF ${items.length} CHECKS</p>` +
      items
        .map(
          (item) =>
            `<details class="${item.passed ? "" : "failed"}"><summary><span>${item.passed ? "+" : "×"}</span><span>${esc(item.name)}</span></summary><pre>Actual: ${esc(JSON.stringify(item.actual, null, 2))}\nExpected: ${esc(JSON.stringify(item.expected, null, 2))}</pre></details>`,
        )
        .join("")
    : "";
}
function render() {
  const frame = frameFor(state.run, state.step);
  $("native-verdict").textContent = frame?.verdict ?? "READY";
  $("native-verdict").className =
    `badge ${frame?.verdict === "PASS" ? "pass" : frame?.verdict === "FAIL" || frame?.verdict === "ERROR" ? "fail" : "neutral"}`;
  $("native-run-title").textContent =
    state.run?.title ?? "Waiting for an execution.";
  $("native-actual").textContent = frame?.receipts ?? "—";
  $("native-expected").textContent =
    state.run?.verdict.checks.find(
      (item) => item.name === "Exactly the expected local fixture completions",
    )?.expected ?? "—";
  $("native-job-status").textContent =
    frame?.rows.find((row) => !row.id.includes("protected"))?.status ?? "—";
  for (const actor of ["A", "B"]) {
    const value = frame?.processes[actor];
    $("worker-" + actor.toLowerCase()).classList.toggle(
      "stopped",
      value?.status === "terminated",
    );
    $("worker-" + actor.toLowerCase() + "-status").textContent =
      value?.status ?? "Not started";
    $("worker-" + actor.toLowerCase() + "-pid").textContent =
      `PID ${value?.pid ?? "—"}`;
  }
  $("native-scrubber").max = frame?.total ?? 0;
  $("native-scrubber").value = frame?.step ?? 0;
  $("native-step").textContent = frame
    ? `${String(frame.step).padStart(2, "0")} / ${String(frame.total).padStart(2, "0")}`
    : "00 / 00";
  $("native-caption").textContent = frame?.event
    ? eventText(frame.event)
    : "Select a step to inspect committed state.";
  $("native-clock").textContent = frame?.event?.at ?? "CONTROLLED CLOCK";
  $("native-rows").innerHTML =
    frame?.rows
      .map(
        (row) =>
          `<div class="native-job-row"><strong>${esc(row.id)}</strong><span>${esc(row.status)}</span><span>GEN. ${esc(row.attempt_count)}</span></div>`,
      )
      .join("") ?? "";
  const scroll = $("native-trace").scrollTop;
  const focusedStep = document.activeElement?.dataset?.nativeStep;
  $("native-trace").innerHTML =
    state.run?.trace
      .map(
        (event) =>
          `<button data-native-step="${event.step}" class="${event.step === state.step ? "selected " : ""}${["process-start", "process-killed", "claim-result", "completion"].includes(event.kind) ? "important" : ""}"><span>${String(event.step).padStart(2, "0")}</span><span>${esc(eventText(event))}</span></button>`,
      )
      .join("") ?? "";
  $("native-trace").scrollTop = scroll;
  if (focusedStep)
    $("native-trace")
      .querySelector(`[data-native-step="${focusedStep}"]`)
      ?.focus({ preventScroll: true });
  controls();
}
function show(run) {
  stopPlayback();
  state.run = run;
  state.step = run.trace.length;
  $("native-condition").value = run.condition;
  render();
  checks();
}
function verification() {
  const result = state.report?.best?.verification;
  $("native-verification").hidden = !result;
  if (!result) return;
  $("native-verification").innerHTML =
    `<strong>${result.passed ? "CHECKED" : "FAILED"} / ${result.cases.filter((item) => item.passed).length} OF ${result.tested} CONDITIONS</strong><p>${esc(state.report.model)}. Executed against the fixed recovery contract.<br>Ten finite conditions; completion uses RaceLab's fixed generation guard.</p><div class="native-matrix">${result.cases.map((item) => `<button data-native-condition="${esc(item.id)}" class="${item.passed ? "" : "failed"}"><span>${esc(item.title)}</span><strong>${item.passed ? "PASS" : "FAIL"}</strong></button>`).join("")}</div>`;
}
function accept(report) {
  state.report = report;
  renderInvestigation($("native-investigation"), report);
  state.source = report.startingSource;
  state.original = new Map([
    ["normal", report.baseline],
    ...report.probes.map((probe) => [probe.run.condition, probe.run]),
  ]);
  $("normal-verdict").textContent = report.baseline.verdict.passed
    ? "PASS"
    : "FAIL";
  $("stop-verdict").textContent =
    state.original.get("crash-restart")?.verdict.passed === false
      ? "FAIL"
      : "—";
  state.version = report.best ? "candidate" : "original";
  code();
  verification();
  if (report.best) {
    const run =
      report.best.verification.cases.find((item) => item.id === "crash-restart")
        ?.run ?? report.best.verification.cases[0]?.run;
    if (run) show(run);
  } else if (report.probes.length) show(report.probes.at(-1).run);
  controls();
}
async function execute() {
  const condition = $("native-condition").value;
  if (state.version === "candidate") {
    const item = state.report.best.verification.cases.find(
      (item) => item.id === condition,
    );
    if (item) return show(item.run);
  }
  const run = await api("/api/workloads/tend/execute", {
    action: "run",
    source: state.source,
    condition,
  });
  state.original.set(condition, run);
  show(run);
  if (condition === "normal")
    $("normal-verdict").textContent = run.verdict.passed ? "PASS" : "FAIL";
  if (condition === "crash-restart")
    $("stop-verdict").textContent = run.verdict.passed ? "PASS" : "FAIL";
}
function event(message) {
  const row = document.createElement("p");
  row.className = "native-log-event";
  row.textContent = message;
  $("native-events").append(row);
  $("native-log-count").textContent = String(
    $("native-events").children.length,
  ).padStart(2, "0");
}
function invalidate() {
  stopPlayback();
  state.report = null;
  renderInvestigation($("native-investigation"), null);
  state.run = null;
  state.original.clear();
  state.step = 0;
  $("normal-verdict").textContent = $("stop-verdict").textContent = "—";
  verification();
  render();
  checks();
}
$("native-source").addEventListener("input", () => {
  if (state.version !== "original") return;
  state.source = $("native-source").value;
  try {
    sessionStorage.setItem("racelab-method-draft", state.source);
  } catch {}
  invalidate();
  code();
});
$("native-source").addEventListener("scroll", () => {
  $("native-highlight").scrollTop = $("native-source").scrollTop;
  $("native-highlight").scrollLeft = $("native-source").scrollLeft;
  $("native-lines").scrollTop = $("native-source").scrollTop;
});
$("native-run").addEventListener("click", () =>
  perform("Executing the selected process condition…", execute),
);
$("native-condition").addEventListener("change", () =>
  perform("Replaying this controlled condition…", execute),
);
$("native-original").addEventListener("click", () =>
  perform("Opening the original method…", async () => {
    state.version = "original";
    code();
    const cached = state.original.get($("native-condition").value);
    if (cached) show(cached);
    else await execute();
  }),
);
$("native-candidate").addEventListener("click", () => {
  if (state.busy || !state.report?.best) return;
  state.version = "candidate";
  code();
  execute();
});
$("native-reset").addEventListener("click", () =>
  perform("Restoring the pinned method…", async () => {
    state.version = "original";
    state.source = state.input.source;
    invalidate();
    code();
    await execute();
  }),
);
$("native-recorded").addEventListener("click", () =>
  perform(
    "Recomputing the recorded Meta method against SQLite. No model calls…",
    async () => {
      if (state.source !== state.input.source)
        throw new Error(
          "The recording belongs to the pinned method. Reset your edits or investigate the edited method.",
        );
      const report = await api("/api/workloads/tend/replay", {
        recorded: true,
      });
      event(
        `Recorded Meta investigation. Re-executed: ${report.recordedRequests ?? "—"} original requests; no new model calls.`,
      );
      for (const patch of report.patches) event(patch.explanation);
      accept(report);
    },
  ),
);
$("native-agent").addEventListener("click", () =>
  perform("Meta is investigating this repository method…", async () => {
    state.report = null;
    verification();
    $("native-events").replaceChildren();
    $("native-log-count").textContent = "00";
    const response = await fetch(
      state.live ? "/api/live/repair" : "/api/workloads/tend/agent",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: state.source }),
      },
    );
    if (!response.ok) {
      const result = await response.json();
      throw new Error(
        result.error ?? "The Meta investigation could not start.",
      );
    }
    const jobId = response.headers.get("X-RaceLab-Job-Id");
    if (jobId) {
      sessionStorage.setItem("racelab-last-live-job", jobId);
      $("project-recover").hidden = false;
    }
    const reader = response.body.getReader(),
      decoder = new TextDecoder();
    let buffer = "",
      complete = false;
    let streamError = "";
    while (true) {
      const next = await reader.read();
      buffer += decoder.decode(next.value, { stream: !next.done });
      let end;
      while ((end = buffer.indexOf("\n\n")) !== -1) {
        const block = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        if (!block.startsWith("data: ")) continue;
        const item = JSON.parse(block.slice(6));
        if (item.type === "error")
          streamError = item.message ?? "The live repair could not complete.";
        if (item.message) event(item.message);
        if (item.type === "baseline") {
          $("normal-verdict").textContent = item.run.verdict.passed
            ? "PASS"
            : "FAIL";
        }
        if (item.type === "probe") show(item.probe.run);
        if (item.type === "complete") {
          accept(item.result);
          complete = true;
          if (item.result.error) event(item.result.error);
        }
      }
      if (next.done) break;
    }
    if (!complete)
      throw new Error(
        streamError ||
          "Stream interrupted. Use Recover last AI run before starting another investigation.",
      );
    if (state.live) await refreshLive();
  }),
);
$("native-verification").addEventListener("click", (event) => {
  const button = event.target.closest("[data-native-condition]");
  if (!button || state.busy) return;
  const run = state.report?.best?.verification.cases.find(
    (item) => item.id === button.dataset.nativeCondition,
  )?.run;
  if (run) {
    state.version = "candidate";
    code();
    show(run);
  }
});
function choose(step) {
  state.step = Math.max(
    0,
    Math.min(state.run?.trace.length ?? 0, Number(step)),
  );
  render();
}
$("native-scrubber").addEventListener("input", () => {
  stopPlayback();
  choose($("native-scrubber").value);
});
$("native-trace").addEventListener("click", (event) => {
  const button = event.target.closest("[data-native-step]");
  if (button && !state.busy) {
    stopPlayback();
    choose(button.dataset.nativeStep);
  }
});
function stopPlayback() {
  if (state.playing) clearInterval(state.playing);
  state.playing = null;
  $("native-play").innerHTML = "&#9654;";
  $("native-play").setAttribute("aria-label", "Play process trace");
}
$("native-play").addEventListener("click", () => {
  if (state.playing) return stopPlayback();
  if (!state.run) return;
  if (state.step >= state.run.trace.length) choose(0);
  $("native-play").textContent = "Ⅱ";
  $("native-play").setAttribute("aria-label", "Pause process trace");
  state.playing = setInterval(() => {
    choose(state.step + 1);
    if (state.step >= state.run.trace.length) stopPlayback();
  }, 650);
});
function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$("native-export").addEventListener("click", () => {
  if (state.report)
    download(
      "racelab-tend-regression.json",
      JSON.stringify(state.report, null, 2),
      "application/json",
    );
});
$("native-diff").addEventListener("click", () => {
  if (state.report?.best)
    download(
      "tend-claim-method.diff",
      methodDiff(state.input.source, state.report.best.source),
      "text/plain",
    );
});
$("native-import").addEventListener("click", () =>
  $("native-import-dialog").showModal(),
);
$("native-import-close").addEventListener("click", () =>
  $("native-import-dialog").close(),
);
$("native-import-file").addEventListener("change", async () => {
  const file = $("native-import-file").files[0];
  if (!file) return;
  if (file.size > 3_200_000)
    return status("Report exceeds the 3.2MB limit.", true);
  $("native-import-json").value = await file.text();
});
$("native-import-confirm").addEventListener("click", () =>
  perform("Executing imported source and conditions again…", async () => {
    const report = JSON.parse($("native-import-json").value);
    accept(await api("/api/workloads/tend/replay", { report }));
    $("native-import-dialog").close();
  }),
);
function applyLive(live) {
  state.live = live;
  state.configured = Boolean(live.enabled);
  $("native-agent").hidden = false;
  $("project-live").hidden = false;
  $("project-live-note").hidden = false;
  $("project-live-note").textContent =
    `${live.reason} Meta Muse Spark · up to 6 turns. Starting sends this method to Meta via Cloudflare.`;
  $("native-agent").textContent = "Run a new Meta Muse Spark repair ↗";
  $("native-live-refresh").hidden = false;
  const guide = $("native-agent").closest("details");
  guide.open = true;
  guide.querySelector("summary").innerHTML =
    "New AI repair / your source <span>+</span>";
  $("native-agent-note").textContent =
    `${live.reason} Your method and synthetic execution feedback are sent to Meta Muse Spark via Cloudflare when you start. Up to 6 model turns and 2 candidate proposals. Live reports are available to this browser for 24 hours. Recorded Muse Spark repairs remain separate.`;
  $("native-connection").textContent = live.enabled
    ? "Live Meta Muse Spark · real SQLite checks"
    : "Online lab · live preview unavailable";
  controls();
}
async function refreshLive() {
  if (state.live) applyLive(await api("/api/live/status"));
}
$("native-live-refresh").addEventListener("click", () =>
  perform("Checking live repair availability…", refreshLive),
);
$("project-live").addEventListener("click", () => $("native-agent").click());

function storedProjects() {
  try {
    const value = JSON.parse(localStorage.getItem(PROJECT_KEY) ?? "[]");
    return Array.isArray(value) ? value.slice(0, 4) : [];
  } catch {
    return [];
  }
}
function listProjects() {
  const select = $("project-list");
  select.replaceChildren(new Option("Choose a saved project", ""));
  for (const p of storedProjects())
    if (typeof p.id === "string" && typeof p.name === "string")
      select.append(new Option(p.name.slice(0, 80), p.id));
}
async function recheckProject(report, retained) {
  const checked = await api("/api/workloads/tend/replay", { report });
  // Only the browser-owned server record can establish live model attribution.
  // Downloaded/local JSON alone is always treated as an unverified import.
  if (
    retained?.origin === "live_meta" &&
    retained.runId === report.runId &&
    retained.startingSourceHash === checked.startingSourceHash
  ) {
    for (const key of [
      "model",
      "provider",
      "protocol",
      "origin",
      "turns",
      "events",
      "summary",
      "error",
    ])
      if (retained[key] !== undefined) checked[key] = retained[key];
    checked.recordedRequests = retained.requests;
    checked.recordedCostUsd = retained.costUsd;
  }
  return checked;
}
function setMethod(source) {
  state.version = "original";
  state.source = source;
  invalidate();
  code();
  sessionStorage.setItem("racelab-method-draft", source);
  $("project-draft").hidden = false;
}
$("project-new").addEventListener("click", () => {
  if (state.busy) return;
  setMethod(blankMethod);
  $("project-name").value = "Untitled recovery method";
  $("project-note").textContent =
    "New method. Implement it or ask Meta to propose a method against the fixed contract.";
});
$("project-file").addEventListener("click", () =>
  $("project-file-input").click(),
);
$("project-file-input").addEventListener("change", async () => {
  const file = $("project-file-input").files?.[0];
  if (!file || state.busy) return;
  try {
    if (file.size > 150000)
      throw new Error("Choose a source file smaller than 150KB.");
    setMethod(extractClaimMethod(await file.text()));
    $("project-name").value = file.name.replace(/\.[^.]+$/, "").slice(0, 80);
    $("project-note").textContent =
      `Imported ${file.name}. No model request has been made.`;
  } catch (error) {
    status(error.message, true);
  } finally {
    $("project-file-input").value = "";
  }
});
$("project-draft").addEventListener("click", () => {
  if (state.busy) return;
  const draft = sessionStorage.getItem("racelab-method-draft");
  if (draft) setMethod(draft);
});
$("project-save").addEventListener("click", () => {
  if (state.busy) return;
  try {
    const name =
      $("project-name").value.trim().slice(0, 80) || "Untitled method";
    const item = {
      id: String(Date.now()),
      name,
      source: state.source,
      report: state.report,
      savedAt: new Date().toISOString(),
    };
    const items = [
      item,
      ...storedProjects().filter((p) => p.name !== name),
    ].slice(0, 4);
    const text = JSON.stringify(items);
    if (text.length > 2500000)
      throw new Error(
        "These reports exceed browser storage. Export a regression file instead.",
      );
    localStorage.setItem(PROJECT_KEY, text);
    listProjects();
    $("project-list").value = item.id;
    $("project-note").textContent =
      "Saved in this browser. Opening it will recompute saved evidence.";
  } catch (error) {
    status(error.message, true);
  }
});
$("project-list").addEventListener("change", () =>
  perform("Opening your project and recomputing its evidence…", async () => {
    const item = storedProjects().find((p) => p.id === $("project-list").value);
    if (!item) return;
    setMethod(extractClaimMethod(item.source));
    $("project-name").value = item.name;
    if (item.report && item.report.startingSource === state.source) {
      let retained;
      if (state.live && /^[a-f0-9-]{36}$/.test(item.report.runId ?? "")) {
        try {
          const run = await api("/api/live/jobs/" + item.report.runId);
          if (run.report?.startingSourceHash === item.report.startingSourceHash)
            retained = run.report;
        } catch {
          /* Saved source remains usable after server report expiry. */
        }
      }
      accept(await recheckProject(retained ?? item.report, retained));
    } else await execute();
    $("project-note").textContent =
      "Project opened. Displayed evidence was executed again.";
  }),
);
$("project-recover").addEventListener("click", () =>
  perform(
    "Recovering the last live run without another model call…",
    async () => {
      const id = sessionStorage.getItem("racelab-last-live-job");
      if (!id) return;
      const result = await api("/api/live/jobs/" + encodeURIComponent(id));
      if (result.status === "running")
        throw new Error(
          "That run is still finishing. Wait briefly and recover it again.",
        );
      if (!result.report?.startingSource)
        throw new Error(
          result.report?.error ??
            "No executable report was retained for this run.",
        );
      accept(await recheckProject(result.report, result.report));
      $("project-note").textContent =
        "Recovered and re-executed. No new model calls.";
    },
  ),
);

try {
  const [input, connection] = await Promise.all([
    api("/api/workloads/tend"),
    api("/api/status"),
  ]);
  state.input = input;
  state.source = input.source;
  state.recorded = input.recordedAvailable;
  state.configured =
    connection.configured &&
    connection.authorized &&
    !connection.budget?.blocked;
  $("source-link").href = input.sourceUrl;
  $("source-proof").textContent =
    `SOURCE VERIFIED / ${input.commit.slice(0, 12)} / MIT`;
  $("native-connection").textContent =
    connection.runner === "hosted"
      ? "Online lab · real SQLite execution"
      : state.configured
        ? "Meta ready · local SQLite runner"
        : "Keyless · local SQLite runner";
  $("native-condition").innerHTML = input.conditions
    .map(
      (item) => `<option value="${esc(item.id)}">${esc(item.title)}</option>`,
    )
    .join("");
  $("native-condition").value = "crash-restart";
  if (connection.liveRepair) {
    state.live = connection.liveRepair;
    applyLive(connection.liveRepair);
  } else if (connection.mode === "public-recheck") {
    $("native-investigation").querySelector("p").textContent =
      "Choose Check Meta repair to inspect the retained hypotheses, tool requests, source diff and fresh execution results.";
    $("native-agent").hidden = true;
    const guide = $("native-agent").closest("details");
    guide.open = true;
    guide.querySelector("summary").innerHTML =
      "Try the online lab <span>+</span>";
    $("native-agent-note").textContent =
      "Choose Check Meta repair to execute the retained candidate against ten conditions. Edit source, run an experiment or reopen an exported regression. No API key or sign-in is needed. New model investigations are available in a private installation.";
  } else {
    $("native-agent-note").textContent =
      "New investigation: up to 6 model turns and 2 patches. The displayed method and synthetic execution feedback go to Meta. Existing app budget limits apply. Recorded rechecks make no new model calls.";
  }
  code();
  listProjects();
  $("project-draft").hidden = !sessionStorage.getItem("racelab-method-draft");
  $("project-recover").hidden = !sessionStorage.getItem(
    "racelab-last-live-job",
  );
  await perform(
    "Checking the pinned method before and after interruption…",
    async () => {
      const normal = await api("/api/workloads/tend/execute", {
        action: "run",
        condition: "normal",
      });
      state.original.set("normal", normal);
      $("normal-verdict").textContent = normal.verdict.passed ? "PASS" : "FAIL";
      await execute();
    },
  );
} catch (error) {
  status(error.message, true);
  controls();
}
