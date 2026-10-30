# RaceLab

**It passes alone. It breaks together.** Execute JavaScript handlers under controlled concurrent store operations. Let Meta propose the failing overlap and a source repair. Check the repair against an independent acceptance contract and additional inputs.

This is the standalone RaceLab repository. It contains the workbench, runner, Meta chat integration, accounting, tests and demo. LiveWorld, Kept, tabletop simulation, segmentation and their dependencies are excluded. [Source provenance](docs/provenance.md) identifies the reused event infrastructure.

The interface opens with a moving shared-memory sculpture and a three-chapter scroll replay, followed by the working concurrency lab: editable source, a live trace stage and a checked repair. The sculpture and replay use actual execution frames. **Open the lab** skips directly to the workbench. Light/dark themes, a motion pause control and reduced-motion support are included. [Interface walkthrough and design references](docs/interface.md). Earlier screenshots and the bundled film show the previous interface and remain archived evidence.

## Run locally

Requires Node.js 24.15+ LTS or 26+. No GPU, Docker or external database is required.

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm start
```

Open **http://127.0.0.1:4174/**. On Windows, double-click **`start-racelab.cmd`**. The workbench opens at `/`; the video player is at `/film.html`.

Local execution, recorded Meta replay and report import/export work without an API key. To enable a live paid investigation on a new installation, create `.env.local` using `.env.example` and configure `MODEL_API_KEY`. Preserve an existing `.env.local`. Source and simulated state are sent to Meta only when running a new investigation; the key stays on the backend. Existing local configuration has been retained privately.

The local extract uses the existing accounting ledger through an ignored `RACELAB_LEDGER_DIR` setting, preserving earlier spend and reservations. No ledger records are bundled. Code and dependencies are independent of the earlier checkout. For a fresh installation the default private data directory is `.racelab/`; if an external ledger is configured, it must exist and validate. File locking protects shared budget transactions. App accounting is not the provider account balance.

## Try the experiment

1. Open **The last seat**. The app executes a serial run and a controlled overlap locally: one passes, one commits two orders against one seat.
2. Play the trace, scrub it, or choose **Find the collision** to inspect the actual shared read. The large impact number follows the selected committed state. Expand any acceptance check to see actual/expected values.
3. Choose **Check Meta repair** beside the trace. The recorded model's schedule and candidate source execute again without a new API call, then **Meta repair B** opens for inspection. **Original A** preserves the starting code and failing trace. **Find the race** searches more schedules; **Re-execute** repeats the exact selected schedule.
4. Edit the handler and choose **Run a new Meta investigation** for a paid live run within the existing budget limits. The button is disabled without a key. Editing clears stale results.
5. **Export evidence**, then **Open report**. Source and schedules execute again; imported pass flags and model attribution are not trusted.

The three declared investigations used one run per authored case and two Meta requests each. Generated candidates passed **11 schedules / 4 inputs** (inventory), **29 / 4** (webhook) and **11 / 4** (counter), at a total app-estimated $0.030444. A separate edited-source browser check used two requests / $0.008764 and passed 11 schedules / 4 inputs. These are authored integration studies. Simple round-robin scheduling also exposes the starting bugs; no general repair rate or scheduling superiority is claimed.

The third-party QuickJS/WebAssembly runtime executes actual ES modules. RaceLab controls only the exposed asynchronous operations on a simulated store. Real database transactions, network/OS scheduling and arbitrary Node repositories are outside its scope. Passing finite checks covers only the store semantics and input cases tested. The independent oracle and execution limits remain outside the submitted module.

**[Watch the three-minute demo](public/racelab-demo.mp4)** · [Architecture and evidence](docs/racelab.md) · [Submission draft](docs/racelab-submission.md) · [Third-party notices](THIRD_PARTY_NOTICES.md)

The 179.99-second video uses actual application screenshots paced as stills, recorded Meta outputs, generic synthetic English narration and captions. It was captured before repository extraction and the interface redesign; the archived screenshots retain the earlier navigation and styling. The opening identifies new RaceLab work and reused event infrastructure.

## Verify offline

```sh
npm test
npm run evaluate
npm run check:film
npm run format:check
npm run check:local # with the local server running
```

Tests and these default checks make no model calls. The recording script's explicit `--live --case=...` option makes paid requests and refuses to overwrite retained investigations. No deployment, public repository creation or competition submission is part of this local delivery.
