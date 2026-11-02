# Public executable workbench

The public judge edition at **https://racelab-judge.8ndwvxvrgt.workers.dev/tend.html** runs the actual Node/SQLite harness on Cloudflare Containers. It is separate from the static video/evidence Site. The complete application, film and recorded explorers are also available under the Cloudflare Worker origin.

Judges can run the pinned TEND original, kill the claimant, re-execute the retained Meta candidate against ten conditions, edit the supported method and export/reopen a regression. The store workbench also executes its supported handlers. New model investigations stay in private installations. Retained candidates are model outputs from the disclosed studies; a recheck makes no new model calls.

## Cloudflare deployment

`deploy/cloudflare/` is a separate, pinned CLI/Vite project using the existing `cf` login. Run `npm ci --ignore-scripts --no-audit --no-fund` there, then `cf workers types`, `npx tsc` and `cf deploy`. The installed cf CLI bundles a supported Node version; a separate installation requires Node 24.22+ or a version accepted by its pinned package.

The Worker serves public assets and routes API/MP4 requests to one named container. MP4 uses Node's byte-range server because Static Assets ignores Range requests. The `basic` container has 0.25 vCPU, 1 GiB RAM, a maximum of one instance and a two-minute idle timeout. SSH and outbound internet are disabled. The public origin is allowlisted, previews are disabled and caller-controlled container-port headers are removed. Cold starts can take longer; no local computer or LAN server needs to stay online.

The build uses the root `Dockerfile`, an unprivileged user, production dependencies and the hash-verified pinned TEND input. `RACELAB_CF_IMAGE` can select an already-published digest-pinned registry image. The initial deployed image was built by [the repository's manual image workflow](https://github.com/tang-vu/racelab/actions/runs/41476540415) at source `65aded04bcb8de4c0b443e76ad428b780e306343`. Temporary registry credentials were passed through GitHub Actions secrets and removed after publication; no model key, local configuration or ledger was supplied. The registry image digest is `sha256:e60f28a7d6a620c606d50abe7c473028212f2ce49133d054e918a0e04a0f6db6`.

The manual image workflow needs fresh, short-lived registry credentials for each publication. It does not deploy automatically on pushes. An already-published image can be reused for a Worker-only update with `cf deploy --containers-rollout none`. The retained Render Blueprint is an optional alternative and is not the active host.

Cloudflare Containers is a [metered product on Workers Paid](https://developers.cloudflare.com/containers/platform/pricing/), with included CPU/memory/disk allowances. The instance and idle limits bound scaling, not total account spend. Deployment used the existing authenticated account; no subscription-change command was issued. Experiment SQLite files are disposable, reports are downloaded to the visitor's device and private projects are not stored by this edition.

## Optional Render deployment

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
