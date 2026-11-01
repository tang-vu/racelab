# RaceLab: execution and evidence

Tang Vu's hackathon prototype for developers investigating asynchronous state races.

## The loop

An editable ES module exports `handle(db, request)`. Each request is a separate actor in a shared QuickJS VM. Calling an exposed async store operation queues a request. The host commits one eligible operation and then drains guest promise jobs. That order is a replayable schedule. The VM exposes no Node module loader, network, filesystem or timers. Guest Date and randomness are disabled.

`src/race/engine.mjs` supplies serial, round-robin, seeded random and bounded depth-first schedules. Lock acquisition blocks an actor until release; unresolved execution and step-limit errors fail verification. Every committed operation carries before/after state. There is no claim that these schedules represent a particular database's isolation semantics.

Muse Spark receives the handler, the initial scenario, the fixed contract and a serial trace. It can call `probe_schedule` on the original source and `test_patch` with a complete replacement module. It must probe before submitting a patch. Caps: six model turns, three probes, two patch attempts. No answer patches are supplied. API transport does not automatically retry. Model prose cannot set the verdict.

The oracle in `src/race/oracle.mjs` checks receipts, responses, conservation/completion and unrelated state across the trace. Receipt collections are append-only. A no-op or always-reject repair fails. Candidate verification covers the original inputs and three additional input cases, with up to 40 distinct schedules each. "Complete" means the finite store-operation choices for those exact inputs were exhausted; "capped" means they were not.

Each job uses a separate worker with an empty environment, a 25-second deadline, bounded operations, memory, guest CPU and promise jobs. These limits reduce accidental or adversarial resource use in this local prototype; this is not a hosted multi-tenant security product.

## Retained evidence

The protocol in `demo/racelab-protocol.json` preceded the three live investigations. All attempts are retained in `public/recordings/`; none was retried to select a nicer output.

| Authored case     | Serial original | Overlapped original | Candidate checked schedules | Inputs | Meta requests |
| ----------------- | --------------- | ------------------- | --------------------------- | ------ | ------------- |
| Last seat         | PASS            | FAIL                | 11, PASS                    | 4      | 2             |
| Duplicate webhook | PASS            | FAIL                | 29, PASS                    | 4      | 2             |
| Lost update       | PASS            | FAIL                | 11, PASS                    | 4      | 2             |

All three finite candidate sets completed. Total app-estimated cost: $0.030444. Round-robin scheduling also finds these authored bugs. This is an integration demonstration of the tool/patch/verification loop, not evidence of a new scheduling algorithm or a production repair benchmark.

`demo/racelab-ui-input.json` declares a separate edited-source live browser check; `demo/racelab-ui-result.json` retains its result. Two requests / $0.008764; 11 schedules / 4 inputs passed. It checks editor invalidation, SSE tool feedback and candidate rendering. It is not held-out benchmark evidence.

The frontend clears stale results when source changes. Bundled replay executes the original and candidate again. Imported reports are recomputed against the server's fixed fixture contracts, ignoring supplied pass flags; model attribution is labelled unverified. Original SHA-256 binds a report to source. These hashes provide consistency, not an external proof of model provenance.

## Validation and limits

`tests/racelab.test.mjs` covers actual races and exact replay, no-op rejection, lock controls, capped coverage, sandbox restrictions, CPU interruption, invalid schedules, deadlock, append-only receipts, prototype keys and model claims that cannot forge success. `scripts/check-racelab.mjs` covers HTTP round trips, bundled replay, a forged imported pass and origin rejection without model calls. CI runs the offline recording verifier.

Browser checks include a real downloaded report reopened through a file chooser, an edited-source live investigation, per-step state, exact replay, keyless operation and a 390-pixel viewport. The standalone server includes only RaceLab routes.

The three original experiments cover authored contracts, deterministic simulated store operations and bounded inputs. Mutexes serialize these small examples and may reduce throughput; throughput is not measured here. There is no arbitrary repository runner, external developer study or production bug discovery.

The separate [TEND workload](tend.md) now verifies a pinned TypeScript claim method on real disposable SQLite across controlled process exit/restart and stale-owner conditions. One retained Meta candidate passes ten declared conditions after two requests, app-estimated $0.015165. Its 60-second lease policy and generation-guarded local completion are new adapter contracts, not upstream TEND semantics. This does not establish correctness of TEND's full worker lifecycle or external effects, general OS scheduling, or an AI advantage over direct repair.

Related work: [Antithesis deterministic simulation testing](https://antithesis.com/docs/resources/deterministic_simulation_testing/) and [REINS](https://arxiv.org/abs/2610.13421). RaceLab does not claim to invent deterministic testing or agent-guided scheduling. Meta's demonstrated contribution is proposing executed hypotheses and actual candidate source within a constrained developer workflow.

## Local operation

`start-racelab.cmd` preserves private configuration and starts port 4174. `/` opens the experience and store workbench; `/tend.html` is the repository recovery workbench; `/film.html` is the current TEND demo player. Run `npm run prepare:tend` once to cache the verified public input before offline tests. No external deployment, purchases, submission or messages are part of this delivery. `scripts/serve-keyless.mjs` starts an isolated keyless QA server on 4176 without changing the real ledger.

## Demo artifact

The local player is http://127.0.0.1:4174/film.html. The current movie demonstrates the pinned TEND method, original interruption failure, retained Meta repair, ten conditions, stale-owner rejection and exported report. It uses eight actual Microsoft Edge screenshots paced as stills, generic synthetic narration and English captions. The player has eight seek/play chapter controls. The film does not claim continuous footage, whole-application correctness or production delivery guarantees.

`demo/racelab-storyboard.json` contains the transcript; `demo/racelab-render-manifest.json` binds the finished media and source captures by SHA-256. Actual screenshots and browser provenance live in `docs/tend-shots/`. The earlier store film and its original screenshots remain byte-preserved in archive paths. `npm run check:film` checks current and historical evidence. See [capture and rebuild notes](demo.md) for local browser QA, speech generation and FFmpeg rendering.
