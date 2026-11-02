# Public executable workbench

The deployable judge edition runs the actual Node/SQLite harness. It is separate from the static video/evidence Site. Hosting is prepared and tested locally; a public workbench URL must be verified after connecting the hosting account.

Judges can run the pinned TEND original, kill the claimant, re-execute the retained Meta candidate against ten conditions, edit the supported method and export/reopen a regression. The store workbench also executes its supported handlers. New model investigations stay in private installations. Retained candidates are model outputs from the disclosed studies; a recheck makes no new model calls.

## Deploy on Render

Use [Deploy to Render](https://render.com/deploy?repo=https://github.com/tang-vu/racelab), or connect Render and deploy this repository's `render.yaml`. The Blueprint selects one **Free Docker web service**, Singapore, `/healthz` and manual deployments. No database service, paid disk, API key, access code or accounting ledger is required. Review the selected Free plan before creating the service; do not upgrade or add billing implicitly.

The image installs production dependencies, downloads the pinned public TEND input during its build and verifies its Git blob hash. It starts as the unprivileged `node` user. `RENDER_EXTERNAL_URL` supplies the allowed HTTPS origin and Render's `PORT` is respected. After deployment, use the service's actual URL followed by `/tend.html`; never invent the hostname from the service name.

Render's Free services [sleep after 15 minutes without inbound traffic and restart on the next request](https://render.com/docs/free). The first visit can take about a minute. SQLite files are disposable per experiment; [the ephemeral host filesystem](https://render.com/docs/web-services#ephemeral-filesystem) is sufficient. Downloads stay on the judge's device. This edition does not store private projects or provide uptime guarantees.

## Isolation

`RACELAB_JUDGE_MODE=1` skips `.env.local` entirely and refuses an environment with a nonempty `MODEL_API_KEY` or `RACELAB_LEDGER_DIR`. No ledger is opened or initialized; `/api/status` returns `budget: null`. Both new-investigation endpoints return `PUBLIC_RECHECK_ONLY` before running model code. The Docker build context is an allowlist and excludes private configuration, caches, ledgers, Git history and development tools.

The public service retains the host/origin checks, request size limits, one-experiment-at-a-time guard, bounded source and report validation, QuickJS memory/instruction limits and worker timeouts. Candidate code has no Node imports, filesystem access or networking. TEND SQL is restricted to disposable fixture tables and each worker receives an empty environment. This is a bounded laboratory, not a general code hosting service or a proof of production correctness.

Do not mount the developer's `.racelab`, shared ledger or `.env.local` into a deployment. Do not provide a model key to bypass judge mode. Preserve the original retained studies and their limits.

## Verify before sharing

1. `/healthz` must return HTTP 200. `/api/status` must show `mode: public-recheck`, `runner: hosted`, `configured: false`, `accessRequired: false` and `budget: null`.
2. Open `/tend.html` anonymously: normal **PASS**, interrupted original **FAIL**. Choose **Check Meta repair**: candidate **10/10**. Inspect the stale-owner rejection and distinct process IDs.
3. Download the regression and open that actual file again. Results must be recomputed, with imported attribution marked unverified. Try an edited source and confirm stale results clear.
4. Verify desktop/phone layout and the store lab. Confirm both `/agent` endpoints reject calls, private paths are 404 and cross-origin requests are rejected.
5. Only after those checks, add the real executable URL to the public review page and submission copy. Keep the video/evidence Site available as a separate review route.
