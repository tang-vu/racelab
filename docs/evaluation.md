# Evaluation and limits

The [public recorded explorer](https://racelab-tang-vu.tang-vu.chatgpt.site/evidence.html) exposes the original TEND A/B methods, ten candidate conditions, process timeline, actual/expected checks, retained public hypothesis, failed probe and candidate diff. It verifies the recording SHA-256 before opening it. Original conditions absent from the recording remain explicitly unavailable. Static playback does not execute SQLite. The local `/tend.html` workbench independently re-executes the same artifact and shares the investigation renderer; imported attribution remains unverified.

## Frozen initial and amended studies (retained)

The first protocol was committed in `74dc934` before any study calls. It planned three tasks, two repetitions, counterbalanced arm order, two requests and 8,192 output-token ceiling per arm. Both arms receive the same Muse Spark model, source, contract and development-condition names. Direct proposes then self-reviews without execution feedback. Feedback proposes through `test_candidate`, receives only development checks, then revises. Only the final proposal is scored on held-out conditions. Actual spend and latency can differ under the same ceilings.

The original setup returned an incompatible class-shaped direct proposal, then HTTP 400 on its first feedback request. The original artifact is retained unchanged. The cause of HTTP 400 was not diagnosed from a returned error body. A separately committed amendment (`b3ab84e`) specifies source boundaries identically for both arms and uses the already supported automatic tool-selection request shape. It keeps the sources, evaluators, cases and splits unchanged. It does not replace selected losing attempts.

The amended study completed **two paired repetitions of the TEND claim task**. Both direct and feedback passed **6/6 held-out conditions in each repetition**. The next lifecycle direct request reached the output cap. The frozen runner stopped: **4 completed arms, 1 failed arm, 7 not run, out of 12 planned**. No further live calls were made to improve the result. The full three-task comparison remains incomplete. This sample shows no pass-count advantage; it establishes no general repair rate, lifecycle AI repair result or statistical superiority.

The original artifacts and pre-continuation summary preserve those stopped outcomes. The current [evaluation page](https://racelab-tang-vu.tang-vu.chatgpt.site/evaluation.html) additionally presents the separately declared continuation below. Downloadable original artifacts:

- `demo/comparison-protocol.json` and `demo/comparison-protocol-v2.json`: contracts, splits, limits, source/evaluator hashes and amendment.
- `public/recordings/comparison-study.json`: original failed setup, 3 requests.
- `public/recordings/comparison-study-v2.json`: amended study, 9 requests, $0.070791 settled usage ledger debit.
- `public/recordings/comparison-summary.json`: complete planned matrix, paired results, limitations and accounting.
- `public/recordings/comparison-accounting-review.json`: explicit conservative debit review.

The HTTP 400 returned no usage. Its **entire $1.328129 reservation remains debited**; no entry was deleted and no debit reduced. Explicit review accepted that worst-case debit within the unchanged phase/total/reserve limits. This is not a claim of actual provider billing or a refund. Original known API usage was $0.02373425 before per-call ledger rounding. Both studies total **12 requests and $1.422655 conservative ledger debit**, including the uncertain charge. The output-capped amended request did return usage settled by the transport; its truncated content was not retained. Per-request public rows cannot reconstruct that content and do not pretend to do so.

Held-out means withheld from prompts and tool feedback. The pre-existing public TEND conditions are not novel problem classes, and this design does not establish training-data isolation. The two TEND adapters share source. A small purposive sample cannot support a broad productivity or AI-advantage claim.

## Previously unrun arms: disclosed post-hoc continuation

To finish the requested scope, commit `39de43a` froze a separate collection of **exactly the seven previously unrun arms**. No completed, rejected, truncated or failed prior attempt was repeated. This is explicitly a post-hoc deviation from the original global-stop policy; the initial studies remain stopped and unchanged. Sources, contracts, prompts, evaluator cases/splits, model/reasoning and per-arm token/request ceilings are unchanged. Known settled output failures count as failed arms without retry; HTTP/transport/uncertain-usage errors still stop the entire continuation.

The seven first-time continuation arms used **14 requests / $0.141145 known usage ledger debit**. Across the twelve originally planned arms, **11 returned final candidates and one failed at the output cap; none remain unrun**. Complete-arm held-out passes in this collection are **direct 4/6; feedback 6/6**. Direct lifecycle repetition1 hit the output cap; repetition2 referenced nonexistent `generation` rather than the actual `attempt_count`, failing all six held-out conditions. Both feedback lifecycle candidates pass all four development and six held-out conditions. Claim and airules pairs pass in both arms. Every error and failed check is retained.

These raw outcomes come from a small, correlated, partly post-hoc collection, **not an uninterrupted preregistered three-task benchmark, significance test or general superiority result**. The truncation remains a failed arm. The original incompatible-class/HTTP400 setup remains separate rather than being pooled into this collection.

`demo/comparison-continuation-protocol.json` records the deviation, seven IDs and frozen hashes; `public/recordings/comparison-continuation.json` retains all proposals/development feedback/final checks. The original summary is byte-preserved in `comparison-summary-pre-continuation.json`; `comparison-summary.json` now presents the complete collection and limits. All collections including the original failed setup total **26 requests / $1.563800 conservative ledger debit**, including the unchanged unknown $1.328129 HTTP400 debit. No charge was removed or refunded. The existing phase/total/reserve caps and declared combined ceiling remain respected.

## Actual SQLite lifecycle adapter

`tend-lifecycle-v2` is separate from the original method adapter and leaves the original recording unchanged. It executes claim, renewal and completion methods in QuickJS through bounded SQL in real child processes on a disposable SQLite file. Every mutation must be transactional. Lease expiry is inclusive at 60 seconds; a matching, currently unexpired generation may renew or complete. Renewal preserves generation and updates the lease timestamp.

Ten conditions cover ordinary completion, recovery, stale tokens, long-job renewal, simultaneous claimants, kill after UPDATE but before COMMIT, kill after COMMIT, expired renewal/completion, renewed-lease boundary and different identifiers/generation/date. Real interruption barriers pause the worker inside or after a transaction; the parent observes process exit before restarting. Concurrent SQLite BUSY is allowed only with a bounded losing-worker retry and never two acquired owners. These are controlled boundaries, not an exhaustive OS scheduler.

`public/recordings/lifecycle-validation.json` retains a **RaceLab-authored control** passing ten conditions, plus negative controls that fail renewal and stale completion. Its claim method uses the earlier retained Meta candidate. The new renewal/completion methods are authored controls; ownership checks are inside those methods, not a hidden fixed host guard. The interrupted amended study had no completed new Meta lifecycle proposal. The separate continuation now retains two feedback lifecycle candidates passing all ten conditions, with claim/renewal/completion guards inside the executed candidate source. This adapter does not execute upstream `completeFollowUp`, incidents/community logic, Discord, a whole worker application or exactly-once external effects.

## Additional owned public source

Inputs are pinned in `demo/repository-inputs.json`; preparation verifies the Git blob before execution. Source caches remain ignored. No upstream repository is edited and no service, production configuration, OAuth, live AI or external action is invoked.

| Input                                                | Executed scope                                                                                                           | Result                                                                                                        |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| OpenMusic `bc7544b8412ed867b59c4d8b1097cdddb1661840` | Unchanged project store and `switchProjectWorkspace` in QuickJS, with minimal in-memory Zustand and lyrics/beats facades | 14/14 checks; healthy synchronous repeated-switch control                                                     |
| airules `c092eaf30c24e6735522284ce7c798071d4e64b0`   | Unchanged `diffSync` in QuickJS with a read-only virtual file and supplied generator facade                              | 6/8 conditions meet RaceLab's added minimum line-edit contract; equal-length replacement/reordered lines fail |

OpenMusic browser persistence, React, audio and Tauri are outside the adapter. No license file was found at the inspected public revision; this author-selected source is downloaded into the ignored cache, not relicensed by RaceLab. airules is MIT; its complete license accompanies the input attribution. The airules finding is a new-contract mismatch, not a concurrency bug or an upstream promise. `public/recordings/repository-validation.json` retains the unchanged-code results and failures.

The user selected these public repository checks instead of recruiting testers. **No human usability, customer feedback or time-savings measurement was performed.**

## Reproduce without a key

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run prepare:tend
npm run prepare:repositories
npm test
npm run evaluate:repositories
node scripts/record-lifecycle.mjs
node scripts/run-comparison.mjs
node scripts/run-comparison-v2.mjs
node scripts/run-comparison-continuation.mjs
```

Preparation downloads pinned public source once. Execution/replay makes no model requests. A live study is not a smoke check; retained output is never overwritten or retried by these default commands. Browser verification uses installed Microsoft Edge in fresh contexts, with paid endpoints blocked. Public replay does not replace local recomputation.
