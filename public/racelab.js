const $ = (id) => document.getElementById(id);
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const state = {
  fixtures: [],
  fixture: null,
  source: "",
  serial: null,
  race: null,
  run: null,
  report: null,
  sourceVersion: "original",
  step: 0,
  busy: false,
  configured: false,
  authorized: true,
  playing: null,
};
let statusTimer;

function status(message, error = false) {
  clearTimeout(statusTimer);
  $("status").textContent = message;
  $("status").classList.toggle("error", error);
  if (message && !state.busy)
    statusTimer = setTimeout(
      () => {
        $("status").textContent = "";
      },
      error ? 12000 : 5500,
    );
}

async function api(path, body) {
  const response = await fetch(
    path,
    body === undefined
      ? undefined
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const result = await response.json();
  if (!response.ok)
    throw new Error(result.error || "The experiment could not finish.");
  return result;
}

function setBusy(busy) {
  state.busy = busy;
  document.body.classList.toggle("busy", busy);
  for (const id of [
    "serial-button",
    "race-button",
    "recorded-button",
    "reset-source",
    "import-button",
    "import-confirm",
  ])
    $(id).disabled = busy;
  $("agent-button").disabled = busy || !state.configured || !state.authorized;
  $("source").readOnly = busy || state.sourceVersion === "candidate";
  for (const button of document.querySelectorAll(".case-button"))
    button.disabled = busy;
  $("original-tab").disabled = busy;
  $("candidate-tab").disabled = busy || !state.report?.best;
  $("export-button").disabled = busy || !state.report;
  $("replay-button").disabled = busy || !state.run?.trace.length;
}

async function perform(label, work) {
  if (state.busy) return;
  stopPlayback();
  setBusy(true);
  status(label);
  try {
    await work();
    status("Experiment complete. Results come from executed JavaScript.");
  } catch (error) {
    status(error.message, true);
  } finally {
    setBusy(false);
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => {
      $("status").textContent = "";
    }, 10000);
  }
}

function paintCases() {
  $("case-list").innerHTML = state.fixtures
    .map(
      (fixture, i) =>
        `<button class="case-button ${fixture.id === state.fixture?.id ? "selected" : ""}" data-case="${escape(fixture.id)}" aria-pressed="${fixture.id === state.fixture?.id}"><span>0${i + 1}</span><div><strong>${escape(fixture.title)}</strong><small>${escape(fixture.category)}</small></div></button>`,
    )
    .join("");
}

function sourceDisplay() {
  const candidate = state.sourceVersion === "candidate" && state.report?.best;
  const source = candidate ? state.report.best.source : state.source;
  $("source").value = source;
  $("source").readOnly = state.busy || Boolean(candidate);
  $("line-numbers").textContent = source
    .split("\n")
    .map((_, i) => i + 1)
    .join("\n");
  $("source-size").textContent = `${source.split("\n").length} lines`;
  $("source-label").textContent = candidate
    ? "Meta candidate · B · read only"
    : "Editable original · A";
  $("original-tab").setAttribute("aria-selected", String(!candidate));
  $("candidate-tab").setAttribute("aria-selected", String(Boolean(candidate)));
  $("candidate-tab").disabled = state.busy || !state.report?.best;
}

function metric(id, text, kind) {
  $(id).textContent = text;
  $(id).className = kind ? `${kind}-text` : "";
}

function renderMetrics() {
  metric(
    "serial-verdict",
    state.serial
      ? state.serial.verdict.passed
        ? "PASS"
        : "FAIL"
      : "Ready to run",
    state.serial ? (state.serial.verdict.passed ? "pass" : "fail") : "",
  );
  $("serial-detail").textContent = state.serial
    ? `${state.serial.trace.length} operations checked`
    : "One request at a time";
  metric(
    "race-verdict",
    state.race ? (state.race.verdict.passed ? "PASS" : "FAIL") : "Not tested",
    state.race ? (state.race.verdict.passed ? "pass" : "fail") : "",
  );
  $("race-detail").textContent = state.race
    ? `${state.race.verdict.violations.length} contract violation(s)`
    : "Same code. Same inputs.";
  const verification = state.report?.best?.verification;
  metric(
    "patch-verdict",
    verification
      ? verification.passed
        ? "CHECKED · PASS"
        : "CHECKED · FAIL"
      : "Awaiting a proposal",
    verification ? (verification.passed ? "pass" : "fail") : "",
  );
  $("patch-detail").textContent = verification
    ? `${verification.tested} schedules · ${verification.cases.length} inputs`
    : "The contract stays locked";
}

function explain(run, event) {
  if (!run)
    return "Execute the handler to inspect committed state at every step.";
  if (event)
    return `Request ${String.fromCharCode(65 + event.actor)} · ${event.method}(${event.args.map((arg) => JSON.stringify(arg)).join(", ")}) → ${JSON.stringify(event.result)}. This is a completed store operation.`;
  if (run.status !== "completed")
    return run.error || "Execution did not finish; its contract cannot pass.";
  if (run.verdict.passed)
    return "This execution meets every fixed acceptance condition. Other schedules may produce different outcomes.";
  if (state.fixture.id === "last-seat")
    return `${run.state.orders?.length ?? 0} orders were committed with ${state.fixture.scenario.initial.stock} seat(s) available. Failed checks: ${run.verdict.violations.join(" · ")}.`;
  if (state.fixture.id === "webhook")
    return `${run.state.notifications?.length ?? 0} notifications were committed. Failed checks: ${run.verdict.violations.join(" · ")}.`;
  return `The final count is ${run.state.count}. Failed check: ${run.verdict.violations.join(" · ")}.`;
}

function renderTimeline() {
  const run = state.run;
  if (!run) {
    $("timeline").innerHTML =
      '<div class="timeline-empty"><span> A ──── read ──── write ──── finish</span><span> B ──── read ──── write ──── finish</span><p>The scheduler chooses which request advances at each store operation.</p></div>';
    return;
  }
  const width = Math.max(620, run.trace.length * 67 + 100);
  const colors = ["#71c4ca", "#ecaa83", "#bfade2", "#d7cf8f"];
  const row = (actor) => 65 + actor * 67;
  const height = Math.max(
    214,
    state.fixture.scenario.requests.length * 67 + 55,
  );
  const spacing = (width - 140) / Math.max(run.trace.length - 1, 1);
  const labels = state.fixture.scenario.requests
    .map(
      (request, actor) =>
        `<circle cx="28" cy="${row(actor)}" r="13" fill="${colors[actor]}18" stroke="${colors[actor]}50"/><text x="28" y="${row(actor) + 3}" text-anchor="middle" fill="${colors[actor]}" font-size="10">${String.fromCharCode(65 + actor)}</text><line x1="50" y1="${row(actor)}" x2="${width - 24}" y2="${row(actor)}" stroke="#365264" stroke-dasharray="3 5"/>`,
    )
    .join("");
  const nodes = run.trace
    .map((event, i) => {
      const x = 87 + i * spacing;
      const y = row(event.actor);
      const selected = event.step === state.step;
      const past = event.step <= state.step;
      const label =
        event.method === "compareAndSwap"
          ? "CAS"
          : event.method === "insertOnce"
            ? "ONCE"
            : event.method.toUpperCase();
      const value =
        typeof event.result === "object"
          ? Array.isArray(event.result)
            ? `[${event.result.length}]`
            : "{…}"
          : String(event.result);
      return `<g class="event-node" role="button" tabindex="0" data-step="${event.step}" aria-label="Step ${event.step}, request ${String.fromCharCode(65 + event.actor)}, ${escape(event.method)} ${escape(event.key)}"><text x="${x}" y="22" text-anchor="middle" font-size="8" fill="#6d8999">${String(event.step).padStart(2, "0")}</text><line x1="${x}" y1="32" x2="${x}" y2="${height - 22}" stroke="#456073" opacity="${selected ? 0.65 : 0.15}"/><rect x="${x - 25}" y="${y - 14}" rx="5" width="50" height="28" fill="${selected ? colors[event.actor] : "#1a3a4e"}" stroke="${colors[event.actor]}" opacity="${past || selected ? 1 : 0.65}"/><text x="${x}" y="${y + 3}" text-anchor="middle" fill="${selected ? "#123143" : colors[event.actor]}" font-size="7.5">${escape(label)}</text><text x="${x}" y="${y + 29}" text-anchor="middle" fill="#8aa6b4" font-size="7">${escape(event.key.slice(0, 13))}</text><text x="${x}" y="${y + 40}" text-anchor="middle" fill="${colors[event.actor]}" font-size="7">→ ${escape(value.slice(0, 16))}</text></g>`;
    })
    .join("");
  $("timeline").innerHTML =
    `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" aria-label="Request operations in committed order">${labels}${nodes}</svg>`;
}

function renderState() {
  const run = state.run;
  const event = state.step > 0 ? run?.trace[state.step - 1] : null;
  const snapshot = event?.after ?? state.fixture?.scenario.initial ?? {};
  const previous = event?.before ?? snapshot;
  $("state-step").textContent = event
    ? `After step ${state.step}`
    : "Initial state";
  $("state-view").innerHTML = Object.entries(snapshot)
    .map(([key, value]) => {
      const changed = JSON.stringify(value) !== JSON.stringify(previous[key]);
      const label = Array.isArray(value)
        ? `${value.length} record${value.length === 1 ? "" : "s"}`
        : typeof value === "object" && value !== null
          ? "{…}"
          : String(value);
      return `<div class="state-entry ${changed ? "changed" : ""}"><span>${escape(key)}</span><strong>${escape(label)}</strong>${Array.isArray(value) && value.length ? `<small>${value.map((record) => escape(JSON.stringify(record))).join("<br />")}</small>` : ""}</div>`;
    })
    .join("");
  $("observation-text").textContent = explain(
    run,
    state.step === run?.trace.length ? null : event,
  );
  const checks = run?.verdict.checks ?? [];
  $("checks-count").textContent = run
    ? `${checks.filter((check) => check.passed).length} / ${checks.length}`
    : "—";
  $("checks-view").innerHTML = checks.length
    ? checks
        .map(
          (check) =>
            `<div class="check-row ${check.passed ? "" : "failed"}" title="${escape(`Actual: ${JSON.stringify(check.actual)} · Expected: ${JSON.stringify(check.expected)}`)}"><span>${check.passed ? "✓" : "×"}</span><span>${escape(check.name)}</span></div>`,
        )
        .join("")
    : '<p class="muted">Checks evaluate the full execution, independently of the selected replay step.</p>';
  $("scrubber").max = run?.trace.length ?? 0;
  $("scrubber").value = state.step;
  $("scrubber").disabled = !run?.trace.length;
  $("play-button").disabled = !run?.trace.length;
  $("replay-button").disabled = state.busy || !run?.trace.length;
  $("step-label").textContent = run
    ? `STEP ${String(state.step).padStart(2, "0")} / ${String(run.trace.length).padStart(2, "0")}`
    : "STEP — / —";
}

function showRun(run, title) {
  stopPlayback();
  state.run = run;
  state.step = run.trace.length;
  $("run-title").textContent = title;
  $("run-badge").textContent =
    run.status === "completed"
      ? run.verdict.passed
        ? "PASS"
        : "FAIL"
      : "ERROR";
  $("run-badge").className = `badge ${run.verdict.passed ? "pass" : "fail"}`;
  renderTimeline();
  renderState();
  renderMetrics();
}

function eventMessage(message, type = "") {
  const row = document.createElement("div");
  row.className = `agent-event ${type === "rejected" ? "error" : ""}`;
  const number = document.createElement("span");
  number.textContent = String($("agent-events").children.length + 1).padStart(
    2,
    "0",
  );
  const text = document.createElement("p");
  text.textContent = message;
  row.append(number, text);
  $("agent-events").append(row);
  $("agent-events").scrollTop = $("agent-events").scrollHeight;
}

function showVerification(report) {
  const best = report.best;
  $("verification").hidden = !best;
  if (!best) return;
  const verification = best.verification;
  $("verification").classList.toggle("failed", !verification.passed);
  const provenance =
    report.origin === "imported_recomputed"
      ? "Imported candidate · recomputed"
      : report.origin === "recorded_meta_recomputed"
        ? "Recorded Meta candidate · recomputed"
        : "Live Meta candidate · checked";
  $("verification").innerHTML =
    `<strong>${verification.passed ? "No violation in the checked schedules." : "This candidate still violates the contract."}</strong><p>${escape(provenance)} · ${verification.tested} schedules · ${verification.cases.length} input cases${report.requests != null ? ` · ${report.requests} original model calls` : ""}.</p>${verification.cases.map((item) => `<div class="case-result"><span>${item.index === 0 ? "Original inputs" : `Additional inputs ${item.index}`}</span><span>${item.failed ? `${item.failed} FAIL` : "PASS"} · ${item.tested} schedules${item.exhaustive ? " · complete" : " · capped"}</span></div>`).join("")}<p>${verification.exhaustive ? "The scheduler exhausted its finite store-operation choices for these inputs." : "Some searches reached their schedule cap."} These results cover this simulated store and these inputs.</p>`;
}

function acceptReport(report) {
  state.report = report;
  state.serial = report.baseline;
  state.race =
    report.probes.find(
      (probe) => probe.run.status === "completed" && !probe.run.verdict.passed,
    )?.run ??
    report.probes.at(-1)?.run ??
    null;
  state.sourceVersion = "original";
  sourceDisplay();
  showVerification(report);
  if (state.race) showRun(state.race, "The overlap, from executed evidence.");
  else showRun(state.serial, "The starting handler, checked sequentially.");
  $("export-button").disabled = false;
  renderMetrics();
}

async function selectCase(id, source = null, runSerial = true) {
  state.fixture = state.fixtures.find((fixture) => fixture.id === id);
  if (!state.fixture) throw new Error("Unsupported report contract.");
  state.source = source ?? state.fixture.source;
  state.serial = state.race = state.run = state.report = null;
  state.sourceVersion = "original";
  state.step = 0;
  $("case-title").textContent = state.fixture.title;
  $("case-category").textContent = state.fixture.category;
  $("contract-text").textContent = state.fixture.invariant;
  $("agent-events").replaceChildren();
  $("verification").hidden = true;
  $("export-button").disabled = true;
  $("run-title").textContent = "Find the moment they overlap.";
  $("run-badge").textContent = "READY";
  $("run-badge").className = "badge neutral";
  paintCases();
  sourceDisplay();
  renderMetrics();
  renderTimeline();
  renderState();
  if (runSerial) {
    state.serial = await api("/api/racelab/execute", {
      caseId: id,
      source: state.source,
      action: "run",
    });
    showRun(state.serial, "One request at a time: no overlap.");
  }
}

function stopPlayback() {
  if (state.playing) clearInterval(state.playing);
  state.playing = null;
  $("play-button").textContent = "▶";
  $("play-button").setAttribute("aria-label", "Play execution");
}

$("case-list").addEventListener("click", (event) => {
  const button = event.target.closest("[data-case]");
  if (button && !state.busy)
    perform("Executing the next handler sequentially…", () =>
      selectCase(button.dataset.case),
    );
});

$("source").addEventListener("input", () => {
  if (state.sourceVersion !== "original") return;
  state.source = $("source").value;
  stopPlayback();
  state.serial = state.race = state.run = state.report = null;
  state.step = 0;
  $("verification").hidden = true;
  $("agent-events").replaceChildren();
  $("run-title").textContent = "Source changed. Execute it again.";
  $("run-badge").textContent = "STALE RESULTS CLEARED";
  $("run-badge").className = "badge neutral";
  $("candidate-tab").disabled = true;
  $("export-button").disabled = true;
  $("line-numbers").textContent = state.source
    .split("\n")
    .map((_, i) => i + 1)
    .join("\n");
  $("source-size").textContent = `${state.source.split("\n").length} lines`;
  renderMetrics();
  renderTimeline();
  renderState();
});
$("source").addEventListener("scroll", () => {
  $("line-numbers").scrollTop = $("source").scrollTop;
});
$("reset-source").addEventListener("click", () =>
  perform("Restoring the authored handler…", () =>
    selectCase(state.fixture.id),
  ),
);
$("serial-button").addEventListener("click", () =>
  perform("Executing the original handler sequentially…", async () => {
    state.sourceVersion = "original";
    sourceDisplay();
    state.serial = await api("/api/racelab/execute", {
      caseId: state.fixture.id,
      source: state.source,
      action: "run",
    });
    showRun(state.serial, "One request at a time: no overlap.");
  }),
);
$("race-button").addEventListener("click", () =>
  perform("Searching controlled interleavings locally…", async () => {
    state.sourceVersion = "original";
    sourceDisplay();
    const result = await api("/api/racelab/execute", {
      caseId: state.fixture.id,
      source: state.source,
      action: "search",
      limit: 64,
    });
    state.race = result.firstFailure ?? result.firstPass;
    if (state.race)
      showRun(
        state.race,
        result.firstFailure
          ? "A schedule that breaks the contract."
          : "No violation in this checked schedule set.",
      );
    eventMessage(
      `Local scheduler: ${result.tested} distinct schedules, ${result.failed} failed. ${result.exhaustive ? "Finite choices exhausted." : "Bounded search; other schedules may remain."} No model calls.`,
    );
  }),
);
$("recorded-button").addEventListener("click", () =>
  perform(
    "Re-executing the recorded Meta investigation. No model calls…",
    async () => {
      const report = await api("/api/racelab/replay", {
        recordedCaseId: state.fixture.id,
      });
      await selectCase(report.caseId, report.startingSource, false);
      eventMessage(
        `Recorded ${report.model} investigation from ${new Date(report.createdAt).toLocaleDateString("en-GB")}. The source and schedules were executed again locally; no new model requests.`,
      );
      for (const probe of report.probes) eventMessage(probe.hypothesis);
      for (const patch of report.patches) eventMessage(patch.explanation);
      acceptReport(report);
    },
  ),
);

$("agent-button").addEventListener("click", () =>
  perform("Muse Spark is investigating the current handler…", async () => {
    $("agent-events").replaceChildren();
    $("verification").hidden = true;
    state.report = null;
    state.sourceVersion = "original";
    sourceDisplay();
    renderMetrics();
    const response = await fetch("/api/racelab/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ caseId: state.fixture.id, source: state.source }),
    });
    if (!response.ok) {
      const result = await response.json();
      throw new Error(result.error || "Meta could not start.");
    }
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let complete = false;
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      let end;
      while ((end = buffer.indexOf("\n\n")) !== -1) {
        const block = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);
        if (!block.startsWith("data: ")) continue;
        const event = JSON.parse(block.slice(6));
        if (event.type === "error") throw new Error(event.message);
        if (event.type === "complete") {
          acceptReport(event.result);
          complete = true;
        } else {
          if (event.message) eventMessage(event.message, event.type);
          if (event.type === "baseline") {
            state.serial = event.run;
            renderMetrics();
          }
          if (event.type === "probe") {
            state.race = event.probe.run;
            showRun(event.probe.run, "Meta's proposed interleaving, executed.");
          }
          if (event.type === "patch") showVerification({ best: event.patch });
        }
      }
      if (done) break;
    }
    if (!complete)
      throw new Error(
        "The stream ended before a completed investigation was received. Check the retained run before starting another paid investigation.",
      );
  }),
);

$("original-tab").addEventListener("click", () => {
  state.sourceVersion = "original";
  sourceDisplay();
  if (state.race ?? state.serial)
    showRun(state.race ?? state.serial, "Original handler · A");
});
$("candidate-tab").addEventListener("click", () => {
  if (!state.report?.best) return;
  state.sourceVersion = "candidate";
  sourceDisplay();
  const result = state.report.best.verification.cases[0];
  const run = result.firstFailure ?? result.firstPass;
  if (run) showRun(run, "Meta candidate · B · checked execution");
});
function chooseStep(step) {
  if (!state.run) return;
  state.step = Math.max(0, Math.min(state.run.trace.length, Number(step)));
  renderTimeline();
  renderState();
}
$("timeline").addEventListener("click", (event) => {
  const node = event.target.closest("[data-step]");
  if (node) {
    stopPlayback();
    chooseStep(node.dataset.step);
  }
});
$("timeline").addEventListener("keydown", (event) => {
  const node = event.target.closest("[data-step]");
  if (node && ["Enter", " "].includes(event.key)) {
    event.preventDefault();
    chooseStep(node.dataset.step);
  }
});
$("scrubber").addEventListener("input", () => {
  stopPlayback();
  chooseStep($("scrubber").value);
});
$("play-button").addEventListener("click", () => {
  if (state.playing) {
    stopPlayback();
    return;
  }
  if (state.step >= state.run.trace.length) state.step = 0;
  $("play-button").textContent = "Ⅱ";
  $("play-button").setAttribute("aria-label", "Pause execution");
  state.playing = setInterval(() => {
    chooseStep(state.step + 1);
    if (state.step >= state.run.trace.length) stopPlayback();
  }, 750);
});
$("replay-button").addEventListener("click", () =>
  perform(
    "Re-executing this exact schedule from the initial store…",
    async () => {
      const source =
        state.sourceVersion === "candidate"
          ? state.report.best.source
          : state.source;
      const run = await api("/api/racelab/execute", {
        caseId: state.fixture.id,
        source,
        action: "run",
        schedule: state.run.schedule,
      });
      showRun(run, "Re-executed from the same initial store.");
    },
  ),
);

$("export-button").addEventListener("click", () => {
  if (!state.report) return;
  const blob = new Blob([JSON.stringify(state.report, null, 2)], {
    type: "application/json",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `racelab-${state.fixture.id}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 5000);
  status("Report exported. Its pass flags will be recomputed when opened.");
});
$("import-button").addEventListener("click", () =>
  $("import-dialog").showModal(),
);
$("import-file").addEventListener("change", async () => {
  const file = $("import-file").files[0];
  if (!file) return;
  if (file.size > 3000000) {
    status("Choose a report smaller than 3MB.", true);
    return;
  }
  $("import-json").value = await file.text();
});
$("import-confirm").addEventListener("click", () =>
  perform("Recomputing the imported source and schedules…", async () => {
    let report;
    try {
      report = JSON.parse($("import-json").value);
    } catch {
      throw new Error("Paste or choose a valid JSON report.");
    }
    const result = await api("/api/racelab/replay", { report });
    await selectCase(result.caseId, result.startingSource, false);
    acceptReport(result);
    eventMessage(
      "Imported report. Model attribution is unverified. Original and candidate checks were recomputed locally.",
    );
    $("import-dialog").close();
  }),
);
for (const id of ["about-button", "scope-footer"])
  $(id).addEventListener("click", () => $("about-dialog").showModal());
$("focus-button").addEventListener("click", () => {
  const focused = document.body.classList.toggle("focus-mode");
  $("focus-button").setAttribute("aria-pressed", String(focused));
  $("focus-button").textContent = focused ? "Exit focus" : "Focus";
});
document.addEventListener("keydown", (event) => {
  if (
    event.key === "Escape" &&
    document.body.classList.contains("focus-mode") &&
    !document.querySelector("dialog[open]")
  )
    $("focus-button").click();
});
for (const button of document.querySelectorAll("[data-close]"))
  button.addEventListener("click", () => $(button.dataset.close).close());

try {
  const [fixtures, connection] = await Promise.all([
    api("/api/racelab/fixtures"),
    api("/api/status"),
  ]);
  state.fixtures = fixtures;
  state.configured = connection.configured;
  state.authorized = connection.authorized;
  $("connection").classList.add("ready");
  $("connection").innerHTML =
    `<i></i>${state.configured ? "Meta ready · local runner" : "Keyless · local runner"}`;
  $("agent-note").textContent = state.configured
    ? "New investigation: up to 6 model turns and 2 patch proposals. Your handler goes to Meta. Existing app budget limits apply. Recorded replay makes no new model calls."
    : "No Meta key is configured. Local experiments, recorded replay and report recomputation still work. Live investigation is disabled.";
  await perform("Checking the original handler sequentially…", () =>
    selectCase(fixtures[0].id),
  );
} catch (error) {
  status(error.message, true);
}
