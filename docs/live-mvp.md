# Live Muse Spark MVP

Open **https://racelab.tangvu.dev/**. Paste a method in Original A, import a source file containing `claimNextDue`, or choose **Start blank**. **Run new AI repair** sends that source to **Muse Spark1.3 through Meta Model API**. The model chooses a probe, receives real execution feedback and proposes replacement source. RaceLab independently executes every accepted candidate against ten fixed SQLite/process conditions. There is no alternative-model or saved-answer fallback.

Inspect the failed probe, A/B source, condition matrix and process receipts. Save a project in this browser, export a regression or method diff, and reopen it. Imports discard saved verdicts and execute the source again; arbitrary files cannot establish model attribution. A browser-owned server record can retain its Muse attribution after rechecking. **Recover last AI run** uses that private record without another model request.

## Supported contract

This first vertical accepts one synchronous `claimNextDue(now = new Date())` method using the pinned TEND schema and `followUpFromRow` mapper. The immutable contract has a60-second claim lease, supplied clock, atomic transaction and `attempt_count` as durable generation. A fixed fixture completion guard stays outside candidate code. Full repository import, arbitrary schemas and production patch deployment are outside this MVP.

Files are scanned without executing their contents, limited to150KB and one extracted method of12,000 characters. QuickJS bridges bounded SQL to disposable SQLite in isolated processes. Candidate code has no Node, filesystem, network, credential or oracle access. Ten finite conditions do not prove full application correctness.

## Model and evidence

The backend pins `muse-spark-1.3`, validates the provider's returned model and uses bounded JSON actions with schema-constrained output. These application actions are identified separately from the original Muse study's native tool calls. Public hypotheses, JSON-format rejections and executed feedback are retained; no hidden reasoning is shown. A failed or incomplete run remains failed or incomplete.

The new film input is an authored30-second lease method. Muse chose a live-owner probe, received its failure, produced one rejected malformed JSON action, then proposed a repair passing10/10 conditions in three requests. [Its portable report](../public/recordings/mvp-live-muse.json) remains separate from the frozen studies and earlier Scout diagnostics. Technical camera/edge setup failures remain retained privately. This is a functional integration check, not a repair-rate benchmark or human study.

## Authorization, accounting and storage

The user's existing Meta key is stored only in an encrypted Cloudflare Worker Secret, as explicitly authorized when the user corrected the model choice. It is absent from the container, guest, frontend, source repository and review Site. Requests go directly to the official Meta endpoint in Standard mode with `store:false`; redirects are not followed. No Cloudflare AI model binding is used.

The existing USD2 sponsored allocation and its local canonical hold remain. Historical object name `allocated-live-scout-v1` and allocation label `racelab-public-scout-20261103` are immutable accounting identities, not the current model. Earlier spend and conservative uncertain-charge debits are preserved. The complete text-only request is capped below100,000 UTF-8 bytes; each call reserves131,072 input tokens including protocol/schema overhead, plus the entire4,096-token output cap, at verified Muse prices. There are no images or native tools that could add unbounded input. Usage settles the reservation; missing usage pauses further calls. An explicit protected review records its reason and retains the full debit, cap and history. Never reset/delete/rename state to obtain more budget. The inference allocation does not cap all Cloudflare account costs.

One AI investigation runs at a time, with six model turns, two accepted candidates, six runs/hour and twelve/day per hashed client IP. Exhausted or busy states explain why; original execution, retained Muse checks and regression reopening continue without new model calls. Closing a stream stops subsequent turns while an in-flight request remains accounted.

Server reports use random HttpOnly/Secure/SameSite cookies and salted ownership hashes. They are available in that browser for up to24hours, with max20 global reports; older reports may be evicted sooner. Expiry cleanup occurs on activity. Browser project storage has four slots and a2.5MB limit. Export anything you need to keep. There is no cross-device account, demonstrated adoption or production uptime guarantee.
