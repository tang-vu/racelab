# Public executable workbench

The public judge edition at **https://racelab.tangvu.dev/** runs the actual Node/SQLite harness on Cloudflare Containers. It is separate from the static video/evidence Site. The complete application, film and recorded explorers are also available under the same origin.

The live repair MVP is the homepage at `/`, served directly with HTTP 200. Store experiments are at `/store`; the film is at `/film.html`. Old `/tend.html` links redirect permanently to `/`, preserving the query string and browser fragment. `/index.html` also redirects to the canonical homepage. Cloudflare and local Node routing use the same public paths.

`racelab.tangvu.dev` is a Worker Custom Domain with Cloudflare-managed DNS and HTTPS. The original `racelab-judge.8ndwvxvrgt.workers.dev` alias remains functional. Each public host accepts only requests from its own origin. The Worker normalizes validated backend requests to the stable runner host, preserving the existing container allowlist without rebuilding or restarting it. Tests cover both aliases, cross-origin rejection and preservation of imported regression bodies.

Judges can run the pinned TEND original, kill the claimant, re-execute the retained Meta candidate against ten conditions, and bring a new supported method for a live Meta Muse Spark 1.3 repair. Browser project saves, private run recovery and regression import/export complete the [MVP workflow](live-mvp.md). The store workbench also executes its supported handlers. Retained Muse Spark candidates remain the outputs of the disclosed studies; rechecking them makes no new model calls.

## Cloudflare deployment

`deploy/cloudflare/` is a separate, pinned CLI/Vite project using the existing `cf` login. Run `npm ci --ignore-scripts --no-audit --no-fund` there, then `cf workers types`, `npx tsc` and `cf deploy`. The installed cf CLI bundles a supported Node version; a separate installation requires Node 24.22+ or a version accepted by its pinned package.

The Worker serves public assets and routes execution APIs to one named container. Its video handler streams exact byte ranges from Static Assets, which otherwise ignores Range. New films therefore publish independently of the runner image, with working browser seeks and no whole-file buffering. The `basic` container has0.25vCPU/1GiB RAM, max one instance and a two-minute idle timeout. SSH and outbound internet are disabled. The public origin is allowlisted, previews are disabled and caller-controlled container-port headers are removed. Cold starts can take longer; no local computer or LAN server needs to stay online.

The build uses the root `Dockerfile`, an unprivileged user, production dependencies and the hash-verified pinned TEND input. `RACELAB_CF_IMAGE` can select an already-published digest-pinned registry image. The initial deployed image was built by [the repository's manual image workflow](https://github.com/tang-vu/racelab/actions/runs/41476540415) at source `65aded04bcb8de4c0b443e76ad428b780e306343`. Temporary registry credentials were passed through GitHub Actions secrets and removed after publication; no model key, local configuration or ledger was supplied. The registry image digest is `sha256:e60f28a7d6a620c606d50abe7c473028212f2ce49133d054e918a0e04a0f6db6`.

The manual image workflow needs fresh, short-lived registry credentials for each publication. It does not deploy automatically on pushes. An already-published image can be reused for a Worker-only update with `cf deploy --containers-rollout none`. The retained Render Blueprint is an optional alternative and is not the active host.

Cloudflare Containers is a [metered product on Workers Paid](https://developers.cloudflare.com/containers/platform/pricing/), with included CPU/memory/disk allowances. The instance and idle limits bound scaling, not total account spend. Deployment used the existing authenticated account; no subscription-change command was issued. Experiment SQLite files are disposable. Project saves stay in the browser; the separate LiveRepair Durable Object retains cookie-protected live reports for up to 24 hours and stores its inference accounting persistently.

The Worker calls [Muse Spark 1.3 through Meta Model API](https://dev.meta.ai/docs/protocols/chat-completions), with the user-authorized existing key stored only as encrypted Worker Secret `MODEL_API_KEY`. No Workers AI model binding or fallback is used. Edge requests use `redirect: manual` and reject non-2xx responses without forwarding credentials to another URL. `LIVE` remains `LiveRepair` / `allocated-live-scout-v1`; its historical allocation label `racelab-public-scout-20261103` retains every earlier charge. USD2 remains held in the canonical local ledger, not copied to the host. Do not reset/rename accounting. Unknown charges pause inference; a protected explicit review retains the full debit and records a reason. `/api/live/ops` requires the backend credential and exposes no source/owner data to unauthenticated visitors. Do not upload historical ledger files.

## Optional Render deployment

Use [Deploy to Render](https://render.com/deploy?repo=https://github.com/tang-vu/racelab), or connect Render and deploy this repository's `render.yaml`. The Blueprint selects one **Free Docker web service**, Singapore, `/healthz` and manual deployments. No database service, paid disk, API key, access code or accounting ledger is required. Review the selected Free plan before creating the service; do not upgrade or add billing implicitly.

The image installs production dependencies, downloads the pinned public TEND input during its build and verifies its Git blob hash. It starts as the unprivileged `node` user. `RENDER_EXTERNAL_URL` supplies the allowed HTTPS origin and Render's `PORT` is respected. After deployment, use the service's actual homepage URL; never invent the hostname from the service name.

Render's Free services [sleep after 15 minutes without inbound traffic and restart on the next request](https://render.com/docs/free). The first visit can take about a minute. SQLite files are disposable per experiment; [the ephemeral host filesystem](https://render.com/docs/web-services#ephemeral-filesystem) is sufficient. Downloads stay on the judge's device. This edition does not store private projects or provide uptime guarantees.

## Isolation

`RACELAB_JUDGE_MODE=1` skips `.env.local` entirely and refuses an environment with a nonempty `MODEL_API_KEY` or `RACELAB_LEDGER_DIR`. No historical ledger is opened or initialized in the container; `/api/status` returns `budget: null` for that runner. Its legacy investigation endpoints remain disabled. `/api/live/repair` executes separately in the Worker, using encrypted Worker Secret authorization and its own durable allocation; `/api/status.liveRepair` reports its availability without exposing accounting history. The Docker build context is an allowlist and excludes private configuration, caches, ledgers, Git history and development tools.

The public service retains the host/origin checks, request size limits, one-experiment-at-a-time guard, bounded source and report validation, QuickJS memory/instruction limits and worker timeouts. Candidate code has no Node imports, filesystem access or networking. TEND SQL is restricted to disposable fixture tables and each worker receives an empty environment. This is a bounded laboratory, not a general code hosting service or a proof of production correctness.

Do not mount the developer's `.racelab`, shared ledger or `.env.local` into a deployment. Do not provide a model key to bypass judge mode. Preserve the original retained studies and their limits.

## Verify before sharing

1. `/healthz` must return HTTP200. `/api/status` keeps the keyless container's `mode: public-recheck`, `runner: hosted`, `configured: false`, `accessRequired: false`, `budget: null`, alongside `liveRepair.model: muse-spark-1.3`. No key is returned.
2. Open `/` anonymously: normal **PASS**, interrupted original **FAIL**. Choose **Check Meta repair**: candidate **10/10**. Inspect the stale-owner rejection and distinct process IDs. Follow **Store experiments** and confirm `/store` opens; an old `/tend.html` link must redirect home.
3. Download the regression and open that actual file again. Results must be recomputed, with imported attribution marked unverified. Try an edited source and confirm stale results clear.
4. Verify desktop/phone layout and the store lab. Confirm both `/agent` endpoints reject calls, private paths are 404 and cross-origin requests are rejected.
5. For a new live integration check only when needed, explicitly opt in to `scripts/check-live-mvp.mjs`. It makes one new investigation, retains its protocol and report, and checks fresh file input, actual candidate verification, browser projects, recovery, export/import and private report ownership. Default browser checks block this paid endpoint.
