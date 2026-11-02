import { highlightSource } from "./evidence-view.js";
import { frameFor, eventText, methodDiff } from "./tend-view.js";
import { renderInvestigation } from "./investigation-view.js";

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
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error ?? "The experiment could not finish.");
  return result;
}
function status(message, error = false) {
  $("native-status").textContent = message;
  $("native-status").classList.toggle("error", error);
  $("native-status").hidden = !message;
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
  $("native-export").disabled = disabled || !state.report;
  $("native-diff").disabled = disabled || !state.report?.best;
  $("native-play").disabled = disabled || !state.run?.trace.length;
  $("native-scrubber").disabled = disabled || !state.run;
  $("native-source").readOnly = state.busy || state.version === "candidate";
}
async function perform(message, action) {
  if (state.busy) return;
  stopPlayback();
  state.busy = true;
  document.body.classList.add("busy");
  controls();
  status(message);
  try {
    await action();
    status("");
  } catch (error) {
    status(error.message, true);
  } finally {
    state.busy = false;
    document.body.classList.remove("busy");
    controls();
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
        : "Edited repository method / A";
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
  $("native-trace").innerHTML =
    state.run?.trace
      .map(
        (event) =>
          `<button data-native-step="${event.step}" class="${event.step === state.step ? "selected " : ""}${["process-start", "process-killed", "claim-result", "completion"].includes(event.kind) ? "important" : ""}" aria-label="Step ${event.step}: ${esc(eventText(event))}"><span>${String(event.step).padStart(2, "0")}</span><span>${esc(eventText(event))}</span></button>`,
      )
      .join("") ?? "";
  $("native-trace").scrollTop = scroll;
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
    const response = await fetch("/api/workloads/tend/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: state.source }),
    });
    if (!response.ok) {
      const result = await response.json();
      throw new Error(
        result.error ?? "The Meta investigation could not start.",
      );
    }
    const reader = response.body.getReader(),
      decoder = new TextDecoder();
    let buffer = "",
      complete = false;
    while (true) {
      const next = await reader.read();
      buffer += decoder.decode(next.value, { stream: !next.done });
      let end;
      while ((end = buffer.indexOf("\n\n")) !== -1) {
        const block = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        if (!block.startsWith("data: ")) continue;
        const item = JSON.parse(block.slice(6));
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
        }
      }
      if (next.done) break;
    }
    if (!complete)
      throw new Error(
        "Stream interrupted. Check the retained run before starting another paid investigation.",
      );
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
  if (connection.mode === "public-recheck") {
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
