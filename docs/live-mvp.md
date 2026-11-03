# Live method repair MVP

Open **https://racelab.tangvu.dev/**. Paste a method in Original A, import a `.ts`/`.js` file containing `claimNextDue`, or choose **Start blank**. **Run new AI repair** sends that source to Meta Llama 4 Scout through Cloudflare Workers AI. The model chooses a probe, receives actual execution feedback, and proposes replacement source. RaceLab executes each accepted candidate against all ten independent conditions. No saved repair is substituted for a failed model run.

Inspect the failed probe, A/B method, condition matrix, process receipts and method diff. **Save project** keeps source and evidence in this browser; reopening recomputes it. **Recover last AI run** fetches this browser's server-retained report and executes it again without another model call. **Export regression** produces a portable report; imports discard saved verdicts and recompute them. Arbitrary imported files cannot establish model attribution. A matching browser-owned server record can retain its live model attribution after rechecking.

## Supported input

This first vertical supports one synchronous `claimNextDue(now = new Date())` TypeScript method using the pinned TEND schema and `followUpFromRow` mapper. The immutable contract uses a 60-second claim lease, the supplied clock, transaction atomicity and `attempt_count` as the durable generation. The fixture completion guard stays outside candidate code. The method editor, runner and checks are working software; full repository import, arbitrary schemas and deployment of generated patches are outside this MVP.

Source files are scanned for the method without executing the file. Unsupported syntax should be reduced to the method itself. A file is limited to 150KB, an extracted method to 12,000 characters. Guest code runs in QuickJS with bounded SQL on disposable SQLite and isolated processes. It cannot access Node, the network, host files, credentials or the independent oracle. Passing ten finite conditions does not establish full application correctness.

## Models and evidence

The new public flow uses `@cf/meta/llama-4-scout-17b-16e-instruct`, explicitly identified in each report. Its bounded JSON actions are an application protocol, not fabricated native tool calls. Raw public action text, executed feedback and candidate checks are retained. A failed or incomplete run remains failed or incomplete.

The original film, Muse Spark 1.3 recordings and frozen comparison studies remain unchanged. They do not measure this Scout preview. The new authored integration check uses a different 30-second lease input: an initial protocol check returned two invalid method formats and no accepted candidate. After clarifying method syntax and the database schema in the protocol, a separate UI check reproduced live-owner theft and generated a candidate passing 10/10 conditions in two model requests. Both attempts are retained privately as integration diagnostics. This is a functional check, not a repair-rate benchmark or user study.

## Storage and limits

Source and synthetic execution feedback are sent to Meta through Cloudflare only when a new repair is started. Server reports are accessible with a random HttpOnly, Secure, SameSite cookie in the same browser for 24 hours; at most 20 reports are retained globally, so an older report can be evicted sooner. Expired reports are removed on subsequent activity. Export anything you need to keep. Project saves are local to the browser, with four slots and a 2.5MB limit. They are not a cross-device account or a hosted repository.

The sponsored preview has a fixed USD 2 inference allocation, one active AI investigation, six model turns and two accepted candidate proposals per run, plus six runs/hour and twelve/day per hashed client IP. Cloudflare's native AI binding holds authorization; no developer model key or historical ledger is deployed. A persistent Durable Object reserves before every model request, settles known usage and conservatively debits uncertain usage while pausing new inference for review. Deployment must preserve its storage and allocation identity. The local canonical accounting ledger holds the entire allocation; its historical records remain local.

The cap covers sponsored model inference, not all Cloudflare account costs. Exhausted, busy or unavailable preview states explain the reason and expose a refresh control. Original execution, saved Meta repair rechecks and regression imports remain available without new model calls. Closing the stream stops subsequent model turns; an already-started request is still accounted. A retained report may be recovered afterward.

This is a public MVP for a narrow developer workflow. It has no demonstrated human adoption, whole-repository support, production uptime guarantee or automatic patch deployment.
