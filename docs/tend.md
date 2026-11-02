# TEND: the worker stopped, the job stayed

RaceLab now executes a repository-derived recovery workload in addition to its three simulated-store experiments. This is a narrow adapter for one pinned method, with actual temporary SQLite and controlled process interruptions. It is not a whole-application TEND repair.

## Input and contract

The unchanged input is `claimNextDue` from [tang-vu/tend, revision fe6975ced2c2004e3bb8f91e97c07db878596a06](https://github.com/tang-vu/tend/blob/fe6975ced2c2004e3bb8f91e97c07db878596a06/packages/db/src/store.ts#L1017). The complete source file must match Git blob `6ffed74e343f919d8fe249a3d2c182d8b7870dbd` before extraction. TEND is MIT; its license accompanies the retained source in [third-party notices](../THIRD_PARTY_NOTICES.md). The original repository is never modified.

The method only selects due `scheduled` or `retrying` rows, then commits `claimed` before a processor would run. If the claimant stops at that boundary, the same method cannot recover that row. This reproduces the claim/reclaim limitation of the pinned method, not an observed production incident or a claim that every TEND startup path has been exercised.

RaceLab explicitly adds a recovery policy that the original method did not define: a due claim expires after 60 controlled seconds, including equality. Recovery increments `attempt_count` exactly once, preserves payloads and unrelated rows, and must not steal fresh claims or claim future/completed work. The fixed fixture processor accepts completion only for the currently claimed generation. **This completion guard is new RaceLab instrumentation; the upstream `completeFollowUp` method is not loaded or repaired.** No external delivery occurs, and exactly-once external effects are not established.

## Execution boundary

Node strips TypeScript annotations from the extracted method and row mapper. QuickJS executes the resulting code without Node capabilities. A bounded synchronous `database.prepare(...).get/all/run` and transaction bridge uses `node:sqlite` on a fresh disposable database. This substitutes for TEND's original database driver and schema parser; the mapper is unchanged, with a small essential-shape check rather than the full application schema.

Each worker is a separate child process with an empty environment. RaceLab waits for the committed claim, kills A without invoking the fixture processor, observes process exit, and starts B on the same SQLite file. Time is supplied explicitly; a 90-second clock advance does not wait 90 real seconds. In stale-owner conditions, A remains alive while B reclaims; A's previous generation is then rejected by the fixed completion guard.

The adapter exposes only bounded SELECT/UPDATE statements on `follow_ups`; writes require a transaction. It caps SQL operations, guest memory/CPU and worker execution time. It does not execute arbitrary repository imports, network calls or application startup. The SQL and process actions are controlled sequences, not exhaustive simultaneous-transaction or OS-scheduler exploration. The interface advances committed row state at transaction commit; a SQL statement's connection-local intermediate state is not shown as committed memory.

## Retained investigation

The [protocol](../demo/tend-protocol.json) was committed as `eb52180` before the live investigation. It declares one investigation, at most six model turns, three probes, two patch attempts and ten fixed conditions:

| Condition       | Required behavior                                      |
| --------------- | ------------------------------------------------------ |
| Normal          | Claim and complete one due job                         |
| Crash/restart   | Recover after the original claimant exits              |
| Live owner      | Preserve a 30-second-old claim                         |
| Expired owner   | Recover after 90 seconds and reject the old generation |
| Future          | Leave a job due in an hour untouched                   |
| Completed       | Preserve finished work                                 |
| Retry           | Preserve the due retry path                            |
| Mixed           | Recover without changing future/completed neighbors    |
| Lease edge      | Recover at exactly 60 seconds                          |
| Different input | Handle changed IDs, clock and existing attempt count   |

The [retained Meta investigation](../public/recordings/tend-claims.json) contains one failed original-input probe and one candidate. The original normal run passes; the crash/restart probe leaves the row claimed with zero local completions. The candidate passes all ten conditions. Muse Spark used **2 requests**, app-estimated **$0.015165**. The retained file has SHA-256 `91e2b1ffc0d4ac3940d537b5a7552f15977905743a3480eadfcc8b090480baee` and is not overwritten by formatting or offline replay.

This is one repository-derived integration study. It does not measure repair rate, performance, superiority over a direct repair model or generalization to other repositories. The naive reset control is authored test code: the oracle rejects it for stealing a live claim. It was not a failed Meta proposal in this investigation.

## Run and export

```sh
npm run prepare:tend
npm start
```

Open `http://127.0.0.1:4174/tend.html`. The page executes the original normal and interrupted conditions locally. **Check Meta repair** recomputes the retained source against all ten conditions and opens B. Select any matrix condition, return to original A, scrub process/transaction receipts, and expand actual/expected checks. Editing clears stale results. A recorded recheck refuses to replace edited source.

**Export regression** downloads source, condition identifiers and execution evidence as JSON. **Open report** discards supplied verdicts, traces and process IDs and recomputes them, with imported model attribution marked unverified. To rerun an export from the command line:

```sh
npm run evaluate:tend -- --report="path/to/racelab-tend-regression.json"
```

**Download method diff** targets the exact pinned source file and includes real context for ordinary `git apply --check`. It changes only `claimNextDue`; integrating lease renewal, stale external effects, completion fencing and application lifecycle is separate work. The regression runs in RaceLab's adapter, not the full TEND test suite. Do not apply it directly to a live worker.

New investigations are separate paid actions; they send the displayed method and synthetic execution feedback to Meta using the existing budget gate. Recorded replay and all default verification commands make zero model calls. No automatic transport retry selects a nicer result. Future investigations retain visible model/tool proposals even when validation rejects them.

## Verification

The tests execute actual original/candidate methods on disposable SQLite; observe distinct process IDs and a killed worker's persisted claim; check all ten conditions with an authored recovery control; reject naive resets, no-ops, writes outside transactions, dangerous SQL, unavailable capabilities and infinite loops; and recompute forged reports. The actual HTML, shared experience script and workbench JavaScript run against a keyless local server, including A/B, stale-owner inspection, editing, export/import round trip, theme, playback and origin rejection. The exported diff is checked against the exact verified source using Git.

On November 1 the user authorized an alternate browser-check method after Computer Use could not determine Edge's current URL. A fresh headless Microsoft Edge session controlled through Playwright completed the actual page workflow at 1440 and 390 pixels, with additional 320- and 768-pixel layout checks. The checks include recorded A/B, all ten conditions, stale-owner rejection, theme, exported file import/recompute, edit invalidation, playback and reduced motion, with zero paid calls and unchanged accounting. Actual captures and their hashes are in `docs/tend-shots/`. This is browser rendering and viewport emulation, not a physical-phone test or exhaustive animation/performance audit.

The current three-minute film demonstrates TEND with actual Edge interaction clips and stills, recorded Meta replay and generic synthetic narration. All three earlier films remain byte-preserved under `public/archive/`. [Film provenance and rebuild](demo.md).
