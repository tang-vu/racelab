import { methodDiff } from "./tend-view.js";

const list = (value) => (Array.isArray(value) ? value : []);
const string = (value) => (typeof value === "string" ? value : "Not retained");

// Render public experiment artifacts only. Never enumerate arbitrary report or
// model-message properties: imports may contain private or hostile extra data.
export function investigationEntries(report) {
  if (!report || typeof report !== "object") return [];
  const entries = [];
  for (const probe of list(report.probes).slice(0, 24)) {
    if (!probe || typeof probe !== "object") continue;
    const run = probe.run;
    entries.push({
      title:
        report.protocol === "bounded-json-actions-v1"
          ? "Probe · executed JSON action"
          : "Probe · probe_recovery",
      text: string(probe.hypothesis),
      request: JSON.stringify(
        { condition: run?.condition, hypothesis: probe.hypothesis },
        null,
        2,
      ),
      feedback: run
        ? JSON.stringify(
            {
              status: run.status,
              error: run.error,
              checks: run.verdict?.checks,
            },
            null,
            2,
          )
        : "Executed feedback was not retained.",
    });
  }
  for (const [index, patch] of list(report.patches).slice(0, 12).entries()) {
    if (!patch || typeof patch !== "object") continue;
    const result = patch.verification;
    entries.push({
      title: `Candidate ${index + 1} · ${report.protocol === "bounded-json-actions-v1" ? "executed JSON action" : "test_claim_patch"}`,
      text: string(patch.explanation),
      request:
        typeof patch.source === "string" &&
        typeof report.startingSource === "string"
          ? methodDiff(report.startingSource, patch.source)
          : "Candidate source was not retained.",
      feedback: result
        ? JSON.stringify(
            {
              passed: result.passed,
              tested: result.tested,
              cases: list(result.cases).map((c) => ({
                condition: c?.id,
                passed: c?.passed,
                checks: c?.run?.verdict?.checks,
              })),
            },
            null,
            2,
          )
        : "Independent checks were not retained.",
    });
  }
  if (report.protocol === "bounded-json-actions-v1")
    for (const turn of list(report.turns).slice(0, 6)) {
      if (turn?.rejected && turn?.action?.action === "patch")
        entries.push({
          title: "Rejected candidate · JSON action",
          text: string(turn.action.explanation),
          request: string(turn.action.source).slice(0, 12000),
          feedback: string(turn.rejected),
        });
    }
  return entries;
}

export function renderInvestigation(
  container,
  report,
  { recorded = false } = {},
) {
  container.replaceChildren();
  if (!report) return;
  const doc = container.ownerDocument;
  const add = (parent, tag, text) => {
    const node = doc.createElement(tag);
    node.textContent = text;
    parent.append(node);
    return node;
  };
  const unverified = /unverified|imported/i.test(String(report.model));
  add(
    container,
    "p",
    unverified
      ? "Imported artifact · model attribution unverified."
      : `${string(report.model)} · ${report.origin === "live_meta" ? (report.recomputed ? "server-retained live investigation · re-executed" : "new live model investigation") : recorded ? "recorded execution" : "independently re-executed"}.`,
  );
  add(
    container,
    "p",
    report.origin === "live_meta"
      ? "Fresh model JSON actions and independent execution feedback. Saved Muse Spark studies remain separate. No hidden reasoning is shown."
      : "Retained public hypotheses, request fields and executed checks. The original recording does not contain a complete raw model transcript. No hidden reasoning is shown.",
  );
  const entries = investigationEntries(report);
  if (!entries.length)
    add(
      container,
      "p",
      "No probe or candidate attempts were retained in this artifact.",
    );
  for (const entry of entries) {
    const details = doc.createElement("details");
    add(details, "summary", entry.title);
    add(details, "p", entry.text);
    add(
      details,
      "h4",
      entry.title.startsWith("Probe")
        ? "Retained request fields"
        : "Candidate diff",
    );
    add(details, "pre", entry.request);
    add(details, "h4", "Executed feedback / independent checks");
    add(details, "pre", entry.feedback);
    container.append(details);
  }
}
