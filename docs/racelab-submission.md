# RaceLab submission draft

Owner: Tang Vu. Track: Indie Developer. Intended theme: Build for Your World. Contributor/approval status must match the actual accepted team on the submission platform; no collaborators have been added by this implementation.

**One-line pitch:** A passing sequential test can hide a race. RaceLab lets Meta reproduce the overlap, propose a source repair, and face a fixed executable contract.

**Opening disclosure for the video:** "RaceLab is new hackathon work by Tang Vu. It reuses the Meta integration and local infrastructure from the earlier event prototype, LiveWorld."

**Built for RaceLab:** controlled asynchronous store scheduling, QuickJS sandbox integration, replay traces, independent acceptance contracts, Meta probe-and-patch tools, additional-input verification, source editor, A/B workbench and recomputed report import/export. QuickJS is a third-party runtime; Muse Spark is a Meta model. Earlier event prototypes are excluded from this standalone repository. Reused infrastructure is identified in `docs/provenance.md`.

**Problem:** handlers that pass when requests run alone can oversell stock, duplicate notifications or lose updates when reads and writes overlap. Reproducing the exact order and evaluating a patch requires more than a persuasive explanation.

**Meta usage:** Muse Spark selects interleavings, inspects executed feedback and writes replacement JavaScript. The local runner executes both original and candidate; independent code judges the fixed contract and additional inputs. There is no canned repair lookup.

**Measured result:** one declared investigation for each of three authored cases, six requests total, all three generated candidates pass their checked finite schedule/input sets (11/4, 29/4, 11/4). This is a small integration study. Simple scheduling baselines also expose the starting races. General repair performance and production capability are not claimed.

**Repository workload:** a pinned MIT TypeScript method from TEND now runs in a bounded QuickJS/SQLite adapter across real process exit/restart and ten declared recovery conditions. One retained investigation used two Meta requests ($0.015165); one proposed method passed all ten. The lease policy and fixed local completion guard are new RaceLab contracts. TEND's existing application features and source are input, not new project work. [Exact provenance and limits](tend.md).

**Technical scope:** the original experiments execute JavaScript handlers on a simulated asynchronous store. The separate repository adapter executes only TEND's pinned claim method through Node's SQLite driver. It does not instrument arbitrary repositories, run the complete TEND application or verify external delivery. A PASS covers the checked inputs and operation/process conditions. No general repair-rate or AI superiority claim is supported.

**Current video:** the November 1 three-minute film demonstrates TEND's original normal PASS, stopped-worker FAIL, recorded Meta repair, ten-condition matrix, stale-owner rejection and exported regression. Actual Microsoft Edge UI screenshots are paced as stills, with generic synthetic English narration and captions; waiting time is omitted. Its opening distinguishes new work, reused infrastructure and TEND as an existing input. Eight player chapters seek and play the corresponding scenes. The old store-experiment film is preserved as an archive. [Capture provenance](demo.md).

**Rules checked November 1:** the full rendered [Official Rules and waiver](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/waiver) state Impact 30%, Meta AI tooling 25%, Technical depth/execution 20%, Demo 25%. The supplied CV FAQ additionally specifies a public repository, three-minute demo, all contributor names, a standalone event-work extract and a video opening that identifies old/new work. Collaborators must be approved participants. Do not submit earlier features as new RaceLab contributions or invent an AI submission-filter rule.

**Prepared entry:** [field-oriented submission copy](submission-copy.md) and [final checklist](submission-checklist.md). Public source and video/review publication are authorized as part of the November 1 preparation. The separate LiveWorld repository is not the RaceLab entry. The full workbench remains a local Node/SQLite application; the public review page hosts video and reproducibility links. The representative must still confirm the signed-in form fields, personal eligibility/team declarations and final submission. No entry or organizer message is sent by this preparation.
