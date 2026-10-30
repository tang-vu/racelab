import { highlightSource, collisionPair, impactFor } from "./evidence-view.js";
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
    "inspect-candidate",
  ])
    $(id).disabled = busy;
  $("agent-button").disabled = busy || !state.configured || !state.authorized;
  $("source").readOnly = busy || state.sourceVersion === "candidate";
  $("play-button").disabled = busy || !state.run?.trace.length;
  $("scrubber").disabled = busy || !state.run?.trace.length;
  for (const button of document.querySelectorAll(".case-button"))
    button.disabled = busy;
  $("original-tab").disabled = busy;
  $("candidate-tab").disabled = busy || !state.report?.best;
  $("export-button").disabled = busy || !state.report;
  $("replay-button").disabled = busy || !state.run?.trace.length;
  $("collision-button").disabled =
    busy || !collisionPair(state.run, state.fixture?.id);
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
        `<button class="case-button ${fixture.id === state.fixture?.id ? "selected" : ""}" data-case="${escape(fixture.id)}" aria-pressed="${fixture.id === state.fixture?.id}"><span>0${i + 1}</span><span class="case-art" aria-hidden="true"><i>A</i><i>B</i></span><div><strong>${escape(fixture.title)}</strong><small>${escape(fixture.category)}</small></div></button>`,
    )
    .join("");
}

function sourceDisplay() {
  const candidate = state.sourceVersion === "candidate" && state.report?.best;
  const source = candidate ? state.report.best.source : state.source;
  if ($("source").value !== source) {
    $("source").scrollTop = $("source").scrollLeft = 0;
    $("line-numbers").scrollTop = 0;
  }
  $("source").value = source;
  $("source-highlight").innerHTML = highlightSource(source);
  $("source-highlight").scrollTop = $("source").scrollTop;
  $("source-highlight").scrollLeft = $("source").scrollLeft;
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
      : "Unchecked",
    verification ? (verification.passed ? "pass" : "fail") : "",
  );
  $("patch-detail").textContent = verification
    ? `${verification.tested} schedules · ${verification.cases.length} inputs`
    : "The contract stays locked";
  $("patch-detail").classList.toggle("sr-only", !verification);
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
      '<div class="timeline-empty">Run the handler.<br>The scheduler will expose the overlap.</div>';
    return;
  }
  const width = Math.max(760, run.trace.length * 88 + 90);
  const height = Math.max(
    232,
    state.fixture.scenario.requests.length * 86 + 60,
  );
  const colors = ["#f2a087", "#a5b1ed", "#dbca98", "#a7d8de"];
  const row = (actor) => 75 + actor * 86;
  const spacing = (width - 174) / Math.max(run.trace.length - 1, 1);
  const pair = collisionPair(run, state.fixture.id);
  const lanes = state.fixture.scenario.requests
    .map((request, actor) => {
      const points = run.trace.filter(
        (event) => event.actor === actor && event.step <= state.step,
      );
      const last = points.at(-1);
      const end = last ? 111 + (last.step - 1) * spacing : 72;
      return `<text x="24" y="${row(actor) - 11}" fill="${colors[actor]}" font-size="14" font-family="Consolas,monospace">${String.fromCharCode(65 + actor)}</text><text x="24" y="${row(actor) + 8}" fill="#8d8d8d" font-size="8">REQUEST</text><line x1="72" y1="${row(actor)}" x2="${width - 24}" y2="${row(actor)}" stroke="#3b3b3b" stroke-dasharray="3 5"/><line x1="72" y1="${row(actor)}" x2="${end}" y2="${row(actor)}" stroke="${colors[actor]}" opacity=".55"/>`;
    })
    .join("");
  const nodes = run.trace
    .map((event, i) => {
      const x = 111 + i * spacing,
        y = row(event.actor);
      const selected = event.step === state.step,
        past = event.step <= state.step;
      const shared = pair && [pair.first, pair.second].includes(event.step);
      const color = shared ? "#ff9b70" : colors[event.actor];
      const label =
        event.method === "compareAndSwap"
          ? "CAS"
          : event.method === "insertOnce"
            ? "ONCE"
            : event.method.toUpperCase();
      const result =
        event.result === null
          ? "empty"
          : Array.isArray(event.result)
            ? `[${event.result.length}]`
            : typeof event.result === "object"
              ? "{...}"
              : String(event.result);
      return `<g class="event-node" role="button" tabindex="0" data-step="${event.step}" aria-label="Step ${event.step}, request ${String.fromCharCode(65 + event.actor)}, ${escape(event.method)} ${escape(event.key)}"><text x="${x}" y="24" text-anchor="middle" fill="${selected ? "#eeeeee" : "#898989"}" font-size="10" font-family="Consolas,monospace">${String(event.step).padStart(2, "0")}</text>${selected ? `<line class="current-line" x1="${x}" y1="34" x2="${x}" y2="${height - 15}"/>` : ""}<rect class="event-box" x="${x - 31}" y="${y - 17}" width="62" height="34" rx="8" fill="${selected ? color : shared && past ? "#382c28" : "#242424"}" stroke="${past ? color : "#494949"}" stroke-width="${selected ? 1.5 : 1}"/><text x="${x}" y="${y + 4}" text-anchor="middle" fill="${selected ? "#1c1c1c" : past ? color : "#8a8a8a"}" font-size="10" font-family="Consolas,monospace">${escape(label)}</text><text x="${x}" y="${y + 34}" text-anchor="middle" fill="#b0b0b0" font-size="10" font-family="Consolas,monospace">${escape(event.key.slice(0, 13))}</text><text x="${x}" y="${y + 49}" text-anchor="middle" fill="${past ? color : "#888888"}" font-size="9" font-family="Consolas,monospace">${escape(result.slice(0, 16))}</text></g>`;
    })
    .join("");
  $("timeline").innerHTML =
    `<svg viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" aria-label="Request operations in committed order">${lanes}${nodes}</svg>`;
}

function renderImpact(snapshot) {
  if (!state.fixture) return;
  const value = impactFor(state.fixture, snapshot);
  $("impact-label").textContent = value.label;
  $("impact-actual").textContent = state.run ? value.actual : "\u2014";
  $("impact-expected").textContent = value.expected;
  $("impact-caption").textContent = state.run
    ? `MEMORY AFTER OP. ${String(state.step).padStart(2, "0")}`
    : "EXECUTE TO OBSERVE";
  document
    .querySelector(".impact")
    .classList.toggle(
      "is-failure",
      Boolean(
        state.run &&
        state.step === state.run.trace.length &&
        !state.run.verdict.passed,
      ),
    );
  document
    .querySelector(".impact")
    .classList.toggle(
      "is-pass",
      Boolean(
        state.run &&
        state.step === state.run.trace.length &&
        state.run.verdict.passed,
      ),
    );
}

function renderState() {
  const run = state.run;
  const event = state.step > 0 ? run?.trace[state.step - 1] : null;
  const snapshot = event?.after ?? state.fixture?.scenario.initial ?? {};
  const previous = event?.before ?? snapshot;
  renderImpact(snapshot);
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
            `<details class="check-row ${check.passed ? "" : "failed"}"><summary><span>${check.passed ? "+" : "\u00d7"}</span><span>${escape(check.name)}</span></summary><p>Actual: ${escape(JSON.stringify(check.actual))}<br>Expected: ${escape(JSON.stringify(check.expected))}</p></details>`,
        )
        .join("")
    : '<p class="muted">Execute the handler to check the fixed contract.</p>';
  const pair = collisionPair(run, state.fixture?.id);
  $("collision-button").disabled = state.busy || !pair;
  if (pair && state.step === pair.second) {
    $("observation-label").textContent = "THE SHARED READ";
    $("observation-text").textContent =
      `Two requests read ${pair.key} = ${JSON.stringify(pair.value)} before a write changes it. Both now hold their own copy.`;
  } else
    $("observation-label").textContent =
      state.step === run?.trace.length
        ? "FINAL OBSERVATION"
        : "COMMITTED OPERATION";
  $("scrubber").max = run?.trace.length ?? 0;
  $("scrubber").value = state.step;
  $("scrubber").disabled = state.busy || !run?.trace.length;
  $("play-button").disabled = state.busy || !run?.trace.length;
  $("replay-button").disabled = state.busy || !run?.trace.length;
  $("step-label").textContent = run
    ? `STEP ${String(state.step).padStart(2, "0")} / ${String(run.trace.length).padStart(2, "0")}`
    : "STEP — / —";
  document.dispatchEvent(
    new CustomEvent("racelab:frame", {
      detail: {
        fixture: state.fixture,
        run,
        step: state.step,
        version: state.sourceVersion,
      },
    }),
  );
}

function showRun(run, title) {
  $("serial-button").classList.toggle("active", run === state.serial);
  $("race-button").classList.toggle("active", run === state.race);
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
  $("event-count").textContent = String(
    $("agent-events").children.length,
  ).padStart(2, "0");
  $("agent-events").scrollTop = $("agent-events").scrollHeight;
}

function showVerification(report) {
  const best = report.best;
  $("verification").hidden = !best;
  $("inspect-candidate").hidden = !best;
  if (!best) return;
  const verification = best.verification;
  const provenance =
    report.origin === "imported_recomputed"
      ? "Imported candidate / attribution unverified"
      : report.origin === "recorded_meta_recomputed"
        ? "Recorded Meta / re-executed locally"
        : "Live Meta / executed here";
  $("verification").classList.toggle("failed", !verification.passed);
  $("verification").innerHTML =
    `<strong>${verification.passed ? "No violation in the checked schedules." : "The candidate still breaks the contract."}</strong><p>${escape(provenance)} / ${verification.tested} schedules / ${verification.cases.length} input cases${report.requests != null ? ` / ${report.requests} original model calls` : ""}</p><div class="case-results">${verification.cases.map((item) => `<div class="case-result ${item.failed ? "failed" : ""}"><span>${item.index === 0 ? "Original inputs" : `Additional set ${item.index}`}</span><strong>${item.failed ? "FAIL" : item.tested}</strong><small>${item.failed ? `${item.failed} failed schedules` : `schedules / ${item.exhaustive ? "complete" : "capped"}`}</small></div>`).join("")}</div><p>${verification.exhaustive ? "Finite store-operation choices exhausted for these inputs." : "Some searches reached their cap."} This simulated store and these inputs only.</p>`;
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
  const labels = {
    "last-seat": ["One seat.", "Two buyers.", "reserve-seat.js"],
    webhook: ["One event.", "Two calls.", "send-webhook.js"],
    "lost-update": ["One count.", "Two writes.", "apply-update.js"],
  }[id];
  $("case-title").textContent = labels[2];
  $("experiment-headline").innerHTML =
    `${labels[0]}<br><span>${labels[1]}</span>`;
  $("case-index").textContent =
    ` / EXP. 0${state.fixtures.indexOf(state.fixture) + 1}`;
  $("case-description").textContent = state.fixture.description;
  $("case-category").textContent = state.fixture.category;
  $("contract-text").textContent = state.fixture.invariant;
  $("agent-events").replaceChildren();
  $("event-count").textContent = "00";
  $("verification").hidden = true;
  $("inspect-candidate").hidden = true;
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
    state.race = await api("/api/racelab/execute", {
      caseId: id,
      source: state.source,
      action: "run",
      mode: "interleave",
    });
    showRun(
      state.race,
      state.race.verdict.passed
        ? "The overlap, checked."
        : "Same code. A different ending.",
    );
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
    perform("Executing the next handler sequentially…", async () => {
      const update = async () => {
        await selectCase(button.dataset.case);
        $("workspace").scrollIntoView({ behavior: "instant", block: "start" });
        $("workspace").tabIndex = -1;
        $("workspace").focus({ preventScroll: true });
      };
      if (
        document.startViewTransition &&
        !matchMedia("(prefers-reduced-motion: reduce)").matches &&
        !document.body.classList.contains("motion-paused")
      ) {
        const transition = document.startViewTransition(update);
        await transition.updateCallbackDone;
        await transition.finished;
      } else await update();
    });
});

$("source").addEventListener("input", () => {
  if (state.sourceVersion !== "original") return;
  state.source = $("source").value;
  stopPlayback();
  state.serial = state.race = state.run = state.report = null;
  state.step = 0;
  $("verification").hidden = true;
  $("inspect-candidate").hidden = true;
  $("agent-events").replaceChildren();
  $("event-count").textContent = "00";
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
  $("source-highlight").innerHTML = highlightSource(state.source);
  renderMetrics();
  renderTimeline();
  renderState();
});
$("source").addEventListener("scroll", () => {
  $("line-numbers").scrollTop = $("source").scrollTop;
  $("source-highlight").scrollTop = $("source").scrollTop;
  $("source-highlight").scrollLeft = $("source").scrollLeft;
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
    showRun(state.serial, "One request at a time. No overlap.");
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
      if (state.source !== state.fixture.source)
        throw new Error(
          "The saved repair belongs to the authored source. Reset your edits to replay it, or start a new investigation for this handler.",
        );
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
      if (report.best) viewCandidate();
    },
  ),
);

$("agent-button").addEventListener("click", () =>
  perform("Muse Spark is investigating the current handler…", async () => {
    $("agent-events").replaceChildren();
    $("event-count").textContent = "00";
    $("verification").hidden = true;
    $("inspect-candidate").hidden = true;
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
          if (event.result.best) viewCandidate();
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
function viewCandidate() {
  if (!state.report?.best) return;
  state.sourceVersion = "candidate";
  sourceDisplay();
  const result = state.report.best.verification.cases[0];
  const run = result?.firstFailure ?? result?.firstPass;
  if (run) showRun(run, "Meta candidate · B · checked execution");
  else {
    state.run = null;
    state.step = 0;
    $("run-title").textContent = "The candidate could not finish verification.";
    $("run-badge").textContent = "ERROR";
    $("run-badge").className = "badge fail";
    renderTimeline();
    renderState();
  }
}
$("candidate-tab").addEventListener("click", viewCandidate);
function chooseStep(step) {
  if (!state.run) return;
  state.step = Math.max(0, Math.min(state.run.trace.length, Number(step)));
  renderTimeline();
  renderState();
}
function followStep(step) {
  const node = $("timeline").querySelector(`[data-step="${step}"]`);
  if (!node) return;
  const rect = node.getBoundingClientRect();
  const viewport = $("timeline").getBoundingClientRect();
  if (rect.left < viewport.left || rect.right > viewport.right)
    $("timeline").scrollBy({
      left: rect.left - viewport.left - viewport.width / 2 + rect.width / 2,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
}
$("collision-button").addEventListener("click", () => {
  const pair = collisionPair(state.run, state.fixture.id);
  if (!pair) return;
  stopPlayback();
  chooseStep(pair.second);
  followStep(pair.second);
});
$("inspect-candidate").addEventListener("click", () => {
  $("candidate-tab").click();
  document.querySelector(".workbench").scrollIntoView({
    block: "start",
    behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "instant"
      : "smooth",
  });
});
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
  if (state.step >= state.run.trace.length) chooseStep(0);
  $("play-button").textContent = "Ⅱ";
  $("play-button").setAttribute("aria-label", "Pause execution");
  state.playing = setInterval(() => {
    chooseStep(state.step + 1);
    followStep(state.step);
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
  $("workspace").scrollIntoView({ behavior: "instant", block: "start" });
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
document.addEventListener("racelab:request-frame", () => {
  if (state.fixture) renderState();
});

try {
  const [fixtures, connection] = await Promise.all([
    api("/api/racelab/fixtures"),
    api("/api/status"),
  ]);
  state.fixtures = fixtures;
  state.configured = connection.configured;
  state.authorized = connection.authorized && !connection.budget.blocked;
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
