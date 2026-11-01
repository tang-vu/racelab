const $ = (id) => document.getElementById(id);
const text = (parent, tag, value) => {
  const el = document.createElement(tag);
  el.textContent = value;
  parent.append(el);
  return el;
};
function checks(parent, items) {
  for (const c of items ?? []) {
    const details = document.createElement("details");
    details.classList.toggle("failed", !c.passed);
    text(details, "summary", `${c.passed ? "PASS" : "FAIL"} · ${c.name}`);
    text(
      details,
      "pre",
      `Actual: ${JSON.stringify(c.actual, null, 2)}\nExpected: ${JSON.stringify(c.expected, null, 2)}`,
    );
    parent.append(details);
  }
}
try {
  const get = async (name) => {
    const response = await fetch(`/recordings/${name}.json`);
    if (!response.ok) throw Error("Evaluation artifact unavailable.");
    return response.json();
  };
  const [life, repos, comparison, amended, review, analysis, continued] =
    await Promise.all([
      get("lifecycle-validation"),
      get("repository-validation"),
      get("comparison-study"),
      get("comparison-study-v2"),
      get("comparison-accounting-review"),
      get("comparison-summary"),
      get("comparison-continuation"),
    ]);
  text(
    $("lifecycle-summary"),
    "h3",
    `${life.verification.cases.filter((c) => c.passed).length} / ${life.verification.tested} conditions pass · authored control`,
  );
  text($("lifecycle-summary"), "p", life.attribution);
  for (const c of life.verification.cases) {
    const d = document.createElement("details");
    text(d, "summary", `${c.passed ? "PASS" : "FAIL"} · ${c.id}`);
    checks(d, c.run.verdict.checks);
    const trace = document.createElement("details");
    text(trace, "summary", "Recorded process / SQL trace");
    text(trace, "pre", JSON.stringify(c.run.trace, null, 2));
    d.append(trace);
    $("lifecycle-cases").append(d);
  }
  const b = document.createElement("details");
  text(b, "summary", "Retained negative controls / failures");
  for (const r of life.baseline) {
    text(b, "h3", `${r.condition} · ${r.verdict.passed ? "PASS" : "FAIL"}`);
    checks(b, r.verdict.checks);
  }
  $("lifecycle-cases").append(b);
  const p = $("repository-summary");
  text(
    p,
    "h3",
    `OpenMusic · ${repos.openmusic.checks.filter((c) => c.passed).length}/${repos.openmusic.tested} checks pass`,
  );
  text(p, "p", repos.openmusic.scope);
  const musicChecks = document.createElement("details");
  text(musicChecks, "summary", "Inspect all 14 unchanged-source checks");
  checks(musicChecks, repos.openmusic.checks);
  p.append(musicChecks);
  text(
    p,
    "h3",
    `airules · ${repos.airules.verification.cases.filter((c) => c.passed).length}/${repos.airules.verification.tested} conditions pass`,
  );
  text(
    p,
    "p",
    "Unchanged pinned diffSync in QuickJS with a read-only virtual file/generator facade. Equal-length replacement and reordered lines report zero net changes, failing RaceLab’s added minimum line-edit count contract. This is not a race, CLI execution or an upstream guarantee.",
  );
  for (const c of repos.airules.verification.cases) {
    const d = document.createElement("details");
    text(d, "summary", `${c.passed ? "PASS" : "FAIL"} · ${c.id}`);
    checks(d, c.run.verdict.checks);
    p.append(d);
  }
  const provenance = document.createElement("details");
  text(provenance, "summary", "Pinned public inputs / licenses / hashes");
  for (const pin of repos.inputs) {
    const a = text(provenance, "a", `${pin.repository} / ${pin.path} ↗`);
    a.href = `https://github.com/${pin.repository}/blob/${pin.commit}/${pin.path}`;
    text(provenance, "pre", JSON.stringify(pin, null, 2));
  }
  p.append(provenance);
  const c = $("comparison-summary");
  const allAttempts = [...amended.attempts, ...continued.attempts];
  text(
    c,
    "h3",
    `${analysis.completedArms} final candidates · ${analysis.failedArms} output error · ${analysis.notRunArms} unrun / 12 planned arms`,
  );
  text(
    c,
    "p",
    "Same Muse Spark model, source and contracts; two requests and 8,192 output-token ceiling per arm. Direct self-review receives no executed feedback. Feedback receives development checks before its final proposal. Held-out results are returned only after the final proposal. Two repetitions, three purposive tasks; the two TEND tasks share source. This is not a production repair-rate benchmark or a statistically powered superiority test.",
  );
  text(c, "p", analysis.conclusion);
  const tableWrap = document.createElement("div"),
    table = document.createElement("table");
  tableWrap.className = "evaluation-table-wrap";
  table.className = "evaluation-table";
  text(table, "caption", "Final proposals / independent held-out conditions");
  const header = document.createElement("tr");
  for (const name of [
    "Task / repetition",
    "Arm",
    "Held-out",
    "Requests",
    "Known cost",
    "API time",
  ])
    text(header, "th", name);
  const head = document.createElement("thead");
  head.append(header);
  table.append(head);
  const body = document.createElement("tbody");
  for (const planned of analysis.planned) {
    const a = allAttempts.find((a) => a.id === planned.id) ?? {
      ...planned,
      calls: [],
    };
    const row = document.createElement("tr"),
      cost = a.calls.reduce((n, c) => n + (c.costUsd ?? 0), 0);
    for (const value of [
      `${a.task} / ${a.repetition}`,
      a.arm,
      a.heldOut
        ? `${a.heldOut.cases.filter((c) => c.passed).length}/${a.heldOut.tested}${a.heldOut.error ? " · rejected" : ""}`
        : a.status,
      a.calls.length,
      a.calls.some((c) => c.error)
        ? "included in total"
        : a.calls.length
          ? `$${cost.toFixed(6)}`
          : "—",
      `${(a.calls.reduce((n, c) => n + c.durationMs, 0) / 1000).toFixed(1)}s`,
    ])
      text(row, "td", String(value));
    body.append(row);
  }
  table.append(body);
  tableWrap.append(table);
  c.append(tableWrap);
  text(
    c,
    "p",
    `Amended study: ${amended.requests} requests, $${amended.costUsd.toFixed(6)} known debit. Post-hoc continuation: ${continued.requests} requests, $${continued.costUsd.toFixed(6)} known debit. Including the original failed setup: ${analysis.requests.total} requests and $${analysis.cost.totalConservativeLedgerDebitUsd.toFixed(6)} conservative ledger debit, which retains the original unknown HTTP400 charge. Aggregate includes truncated-response usage omitted from its public per-call row.`,
  );
  if (amended.status === "completed") {
    const direct = amended.attempts.filter((a) => a.arm === "direct"),
      assisted = amended.attempts.filter((a) => a.arm === "feedback");
    const passes = (arms) => arms.filter((a) => a.heldOut?.passed).length;
    text(
      c,
      "p",
      `Complete-arm held-out passes: direct ${passes(direct)}/${direct.length}; feedback ${passes(assisted)}/${assisted.length}. ${passes(direct) === passes(assisted) ? "This sample shows no pass-count advantage for feedback." : "This difference describes this small sample only; it does not establish general superiority."} V2 known usage cost $${amended.costUsd.toFixed(6)} across ${amended.requests} requests.`,
    );
  }
  const artifacts = document.createElement("details");
  text(
    artifacts,
    "summary",
    "Every amended-study proposal and executed feedback",
  );
  for (const a of allAttempts) {
    const d = document.createElement("details");
    text(d, "summary", `${a.id} · ${a.status}`);
    text(
      d,
      "pre",
      JSON.stringify(
        {
          error: a.error,
          first: a.first,
          developmentFeedback: a.developmentFeedback,
          final: a.final,
          development: a.development,
          heldOut: a.heldOut,
        },
        null,
        2,
      ),
    );
    artifacts.append(d);
  }
  c.append(artifacts);
  const metaLife = allAttempts.find(
    (a) =>
      a.task === "tend-lifecycle" && a.repetition === 1 && a.arm === "feedback",
  );
  if (metaLife?.final) {
    const passed = [
      ...(metaLife.development?.cases ?? []),
      ...(metaLife.heldOut?.cases ?? []),
    ].filter((c) => c.passed).length;
    const heading = document.createElement("h3");
    heading.textContent = `Meta lifecycle candidate · ${passed}/10 conditions · first feedback repetition`;
    $("lifecycle-summary").prepend(heading);
    const d = document.createElement("details");
    text(
      d,
      "summary",
      "Meta lifecycle candidate / first feedback repetition / source and independent checks",
    );
    text(
      d,
      "p",
      "This candidate includes claim, renewal and completion ownership guards. It is executed in the new lifecycle adapter, not upstream completeFollowUp or an external delivery system.",
    );
    text(d, "pre", metaLife.final.source);
    for (const item of [
      ...(metaLife.development?.cases ?? []),
      ...(metaLife.heldOut?.cases ?? []),
    ]) {
      const result = document.createElement("details");
      text(result, "summary", `${item.passed ? "PASS" : "FAIL"} · ${item.id}`);
      checks(result, item.run.verdict.checks);
      text(result, "pre", JSON.stringify(item.run.trace, null, 2));
      d.append(result);
    }
    $("lifecycle-summary").append(d);
  }
  const pilot = document.createElement("details");
  text(
    pilot,
    "summary",
    "Retained original failed setup / protocol amendment / conservative accounting",
  );
  c.append(pilot);
  text(
    pilot,
    "h3",
    `${comparison.status} · ${comparison.requests} requests retained`,
  );
  const known = comparison.attempts
    .flatMap((a) => a.calls)
    .reduce((n, c) => n + (c.costUsd ?? 0), 0);
  text(
    pilot,
    "p",
    `Original known usage cost: $${known.toFixed(6)}. Original conservative ledger debit: $${comparison.costUsd.toFixed(6)}. Failed-request billing is unknown. Explicit review accepted its entire $${review.conservativeDebitUsd.toFixed(6)} reserved debit as spent without deleting or reducing it. The original study stays stopped; a separately committed protocol amendment specifies source boundaries and removes forced tool selection. It retains the same evaluators and test splits. This does not diagnose the HTTP 400 root cause or claim a refund.`,
  );
  for (const a of comparison.attempts) {
    const d = document.createElement("details");
    text(d, "summary", `${a.id} · ${a.status}`);
    text(
      d,
      "pre",
      JSON.stringify(
        {
          error: a.error,
          first: a.first,
          final: a.final,
          development: a.development,
          heldOut: a.heldOut,
        },
        null,
        2,
      ),
    );
    pilot.append(d);
  }
  $("evaluation-status").textContent =
    "Saved evaluation artifacts loaded. No code execution or model calls.";
} catch (e) {
  $("evaluation-status").textContent = e.message;
}
