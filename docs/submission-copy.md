# RaceLab: submission copy

Prepared for Tang Vu to review and paste into the signed-in competition form. [Answers mapped to the actual form fields supplied November 2](submission-form.md) are the primary paste-ready version. The longer sections below provide supporting detail. Do not interpret a prepared entry as a submitted entry or as confirmation of personal eligibility. Character limits and video URL validation still require the signed-in form.

## Project name

RaceLab

## Try it online

https://racelab.tangvu.dev/tend.html

The Cloudflare-hosted workbench re-executes the real Node/SQLite experiments, retained Meta candidate and imported regressions without an API key or sign-in. The video/review page remains https://racelab-tang-vu.tang-vu.chatgpt.site . New model investigations are available in a private installation.

## One-line pitch

RaceLab turns Meta-generated repairs into replayable experiments, with independently checked failures and fixes.

## Short description

A developer workbench for failures that sequential tests miss. Meta proposes a failing execution and a source repair; an independent runner checks the result. The demo reproduces job recovery across real SQLite worker interruption and restart.

## Problem and intended impact

Background jobs can become stuck after a worker commits its claim and stops. Handlers can also oversell stock or lose updates when requests overlap. A plausible repair explanation does not show whether the failure is reproduced or whether the fix preserves the surrounding contract.

RaceLab is for developers who need to reproduce those conditions, inspect the committed state, and keep a regression they can execute again. It aims to make model-assisted repair easier to challenge and review. This prototype has no customer-adoption or developer-time-savings measurement yet.

## What it does

Open the pinned TEND method. The original completes uninterrupted work. Stop its worker immediately after the claim commits, observe the actual process exit, and start a replacement on the same disposable SQLite file: the job remains claimed and the independent recovery check fails.

Replay the retained Meta proposal. RaceLab executes its replacement source again and checks ten declared conditions, including fresh and expired claims, future and completed jobs, retries, mixed rows, the exact lease boundary and a changed input. The candidate passes those ten conditions. Inspect original A and candidate B, scrub process/SQL receipts, inspect stale-generation rejection, and export a regression or contextual method diff. Opening an exported report recomputes the source and conditions instead of trusting supplied verdicts.

Three additional authored JavaScript cases demonstrate controlled asynchronous-store scheduling: inventory, webhook deduplication and shared-counter updates.

The public recorded explorer lets reviewers inspect A/B source, conditions, committed-state tracing, retained public Meta hypotheses/requests, candidate diffs and actual/expected checks without installation. It displays saved artifacts, not remote execution. The local workbench independently recomputes them.

## Meaningful use of Meta

Muse Spark 1.3 receives the source, declared contract and executed feedback. Its bounded tools can probe an execution and propose replacement source. The model cannot alter the independent oracle or grant itself a PASS.

The retained TEND investigation was declared before its live run. It used two requests, one failed original crash probe and one proposed method, at an app-estimated $0.015165. The candidate passed all ten declared recovery conditions. Recorded replay executes the retained proposal locally without another model request. This is one integration study, not a general repair-rate or AI-superiority result.

A separately frozen direct/feedback design now has all 12 planned arms attempted once: feedback 6/6 complete-arm held-out passes, direct 4/6. The original runner stopped at truncation; exactly seven previously unrun arms were collected afterward under a separately frozen, disclosed post-hoc continuation. No failed attempt was repeated. Original setup errors and a direct candidate's nonexistent SQL column remain visible. This small, correlated collection is not an uninterrupted preregistered benchmark or general superiority result. [Protocols, outcomes and accounting](evaluation.md).

## Technical depth

QuickJS executes the isolated JavaScript candidate. The repository adapter strips the pinned TypeScript method and mapper and exposes bounded synchronous SQL through Node's SQLite driver in separate child processes. RaceLab controls interruption boundaries and the supplied clock, waits for worker exit, and reopens the same temporary database. SQL writes require a transaction. Execution limits and the acceptance oracle remain outside candidate code.

Browser UI supports editable original source, read-only candidate B, actual/expected checks, ten-condition selection, committed-state traces, theme, replay and report/diff export. Local checks include forged-report recomputation, no-op and unsafe-operation rejection, process interruption and actual browser export/import.

A separate lifecycle adapter tests simultaneous claimants, real interruption before and after commit, long-job renewal and old-token rejection, with ownership checks inside its candidate methods. A retained authored control passes ten conditions and remains separately attributed. Two new feedback lifecycle candidates also pass all ten development/held-out conditions with ownership guards inside their source. Additional pinned owned public inputs retain 14 passing OpenMusic workspace checks and 6/8 airules conditions under RaceLab's added line-edit contract. These are bounded source adapters, not whole-application runs or human feedback.

## New work and existing components

Tang Vu built RaceLab's scheduling engine, independent contracts, Meta probe/patch workflow, repository adapter, interruption harness, A/B interface, replay/export, tests and demo during the event, starting October 29. It reuses Meta transport, budget accounting and local-serving infrastructure built for the earlier event prototype LiveWorld.

TEND's existing MIT method and mapper are source inputs. QuickJS, Playwright, jsdom, Prettier and Google Sans Flex are third-party components, credited with their applicable notices. Meta supplies Muse Spark. FFmpeg and Pillow provide media encoding and original graphic framing. Xiaomi MiMo TTS (Mia) and ASR provide narration and speech checks for the current film; they are media-production tools, separate from the Meta repair model. Those models, libraries and tools are not claimed as RaceLab inventions.

## Scope and evidence

The TEND adapter executes one verified method, not the full application. RaceLab adds the 60-second lease policy and a fixed generation-guarded fixture completion. It does not repair upstream completion or prove exactly-once external effects. PASS covers the declared finite conditions and inputs.

The three store studies execute authored JavaScript handlers against a simulated asynchronous store. Their retained candidates pass 11 schedules / 4 inputs, 29 / 4 and 11 / 4 respectively. Simple scheduling baselines also expose the original failures.

The video combines actual Microsoft Edge UI interaction clips with stills, Xiaomi MiMo synthetic English narration and ASR-checked captions; preparation and model waiting are omitted. Failure and the checked retained repair appear within twenty seconds. Its opening identifies new work, reused event infrastructure and the existing TEND input. All four previous movies are preserved.

## Submission links

- Public source: https://github.com/tang-vu/racelab
- Public video/review: https://racelab-tang-vu.tang-vu.chatgpt.site
- Direct MP4: https://racelab-tang-vu.tang-vu.chatgpt.site/racelab-demo.mp4
- Exact experiment and limits: https://github.com/tang-vu/racelab/blob/main/docs/tend.md
- Video provenance: https://github.com/tang-vu/racelab/blob/main/docs/demo.md
- Official submission portal: https://cerebralvalley.ai/e/meta-ai-developer-hackathon/hackathon/submit

## Participant details to confirm in the account

Prepared under Tang Vu's authorship and the previously selected Indie Developer track / Build for Your World theme. No additional collaborators have been added by this work. The representative must check the actual accepted team, approved-participant status and waiver/eligibility acknowledgments in their account. Personal declarations are not completed by the implementation.
