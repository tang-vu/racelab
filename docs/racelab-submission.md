# RaceLab submission draft

Owner: Tang Vu. Track: Indie Developer. Intended theme: Build for Your World. Contributor/approval status must match the actual accepted team on the submission platform; no collaborators have been added by this implementation.

**One-line pitch:** A passing sequential test can hide a race. RaceLab lets Meta reproduce the overlap, propose a source repair, and face a fixed executable contract.

**Opening disclosure for the video:** "RaceLab is new hackathon work by Tang Vu. It reuses the Meta integration and local infrastructure from the earlier event prototype, LiveWorld."

**Built for RaceLab:** controlled asynchronous store scheduling, QuickJS sandbox integration, replay traces, independent acceptance contracts, Meta probe-and-patch tools, additional-input verification, source editor, A/B workbench and recomputed report import/export. QuickJS is a third-party runtime; Muse Spark is a Meta model. Earlier event prototypes are excluded from this standalone repository. Reused infrastructure is identified in `docs/provenance.md`.

**Problem:** handlers that pass when requests run alone can oversell stock, duplicate notifications or lose updates when reads and writes overlap. Reproducing the exact order and evaluating a patch requires more than a persuasive explanation.

**Meta usage:** Muse Spark selects interleavings, inspects executed feedback and writes replacement JavaScript. The local runner executes both original and candidate; independent code judges the fixed contract and additional inputs. There is no canned repair lookup.

**Measured result:** one declared investigation for each of three authored cases, six requests total, all three generated candidates pass their checked finite schedule/input sets (11/4, 29/4, 11/4). This is a small integration study. Simple scheduling baselines also expose the starting races. General repair performance and production capability are not claimed.

**Technical scope:** JavaScript handlers using an explicitly simulated asynchronous store. It does not instrument arbitrary repositories or real databases. A PASS covers only the checked inputs and store-operation interleavings. The runner is bounded and reports capped searches.

**Rules from the supplied CV FAQ:** public repository, three-minute demo and all contributor names; standalone event-work repository; opening disclosure of old/new work; collaborators must be approved participants. Do not submit earlier features as new RaceLab contributions. The FAQ says equal judging weights while the earlier participant guide lists 30/25/20/25; that discrepancy remains unresolved. Do not invent an AI submission-filter rule.

**Submission state:** local draft only. No public RaceLab deployment, upload, competition submission or organizer contact has been performed. This fresh local repository has no configured GitHub remote and has not been pushed. The earlier LiveWorld repository is not the RaceLab submission repository. A final public entry must point to the actual RaceLab revision and working video, and clearly expose only event-built work.
