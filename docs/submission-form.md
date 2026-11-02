# RaceLab: answers for the actual submission form

Mapped to the signed-in field labels supplied by Tang Vu on November 2, 2026. The supplied text shows no hosted-application field. The video field shows a YouTube example; that alone does not establish a YouTube-only rule. Field validation, dropdown options and character limits have not been observed. Nothing here submits the entry or accepts acknowledgments.

## Team Members

The supplied form shows `tang-vu` / `Vu Tang`. Confirm that this is the accepted participant account and that the team roster is correct. Project authorship is Tang Vu; no additional collaborator was added by this preparation.

## Which track are you submitting to?

Indie Developer — select the matching option in the form.

## Which problem statement did you build towards?

Build for Your World — the previously selected theme. Select the matching option from the actual dropdown.

## If you're competing for the Most Viral Track, please submit your X post link here to be considered.

Leave blank. No X post was created or authorized for this entry.

## Project Description

RaceLab turns Meta-generated repairs into replayable experiments, with independently checked failures and fixes.

A background worker can pass its normal test, commit a job claim, then stop and leave the job stuck. A plausible AI patch does not show whether recovery works or whether it steals work from a live owner. RaceLab lets developers reproduce the failure, inspect the committed state, and keep an executable regression.

The demo runs a pinned TypeScript method from the public TEND repository on real disposable SQLite. RaceLab terminates the worker after commit and restarts another process on the same database. The original fails the added recovery contract; a retained Muse Spark repair passes ten declared conditions. A separate lifecycle adapter tests competing workers, interruption before and after commit, lease renewal and stale-owner rejection, with ownership checks inside candidate source.

Developers can compare A/B source, scrub process/SQL traces, inspect actual versus expected checks, and export a regression or method diff. Import runs the checks again instead of trusting saved PASS flags. A public recorded explorer makes the evidence inspectable without installation; the full workbench recomputes it locally without a model key.

Tang Vu built the lab, adapters, Meta workflow and interface during the event, reusing earlier event transport/accounting infrastructure. TEND is an existing source input. These bounded experiments do not establish whole-application correctness or general repair performance.

## Public GitHub Repository

https://github.com/tang-vu/racelab

## 3-Minute Demo Video

https://racelab-tang-vu.tang-vu.chatgpt.site

This public page plays the current 179.904-second film with English captions and eight chapters. Direct MP4: https://racelab-tang-vu.tang-vu.chatgpt.site/racelab-demo.mp4

Use the public player URL if the field accepts it. If validation requires a particular video provider, satisfy that actual requirement before submitting; do not treat the placeholder as proof that the current URL is accepted. No YouTube upload has been performed.

## Describe your use of Meta products to build the submitted project

RaceLab integrates Muse Spark 1.3 through Meta Model API as its investigation and repair model. It receives source code, an explicit acceptance contract and executed observations. Bounded tools let it probe the original execution and propose replacement source. RaceLab executes that source in QuickJS, with controlled store scheduling or a real SQLite/process adapter, and returns independent check results for revision.

The original TEND investigation retained one failed crash probe and one Meta candidate, using two requests. The candidate passes ten declared recovery conditions. A separate comparison retains every attempted arm, including truncation and invalid SQL: feedback passes all held-out checks in 6/6 arms, direct repair in 4/6. Seven arms were a disclosed post-hoc continuation; the small correlated collection does not establish general superiority. Replay re-executes retained proposals without new model calls. Muse Code is not claimed as a project dependency or as the tool that built the application.

## Why are Meta's models important to your solution?

Muse Spark connects source-code understanding to executable experiments: it proposes the hypothesis, chooses supported probes, reads their actual results and writes candidate source. The repair is generated for the supplied code and contract rather than selected from a canned lookup. Structured tool calls make the proposal, feedback and revised source reviewable.

The model supplies hypotheses and repairs; independent code decides whether they pass. That separation is central to RaceLab: developers can challenge an AI-generated fix and retain a regression instead of relying on its explanation. The evidence demonstrates this bounded workflow, not a claim that Meta outperforms every other model.

## Provide feedback from your experience using partner technologies. Fireworks, Modal, Baseten

We did not use Fireworks, Modal or Baseten in this project. RaceLab sends model requests directly to Meta Model API, so we have no project-specific partner-technology feedback to report.

## How likely are you to build with Meta Model API?

Personal response required: choose the option that reflects your own intention. No score has been selected for you.

## How would you describe your overall opinion of Meta Model API?

Personal response required: choose your own overall rating. The project evidence supports working structured tool calls and executed source repairs, with retained API/setup and output-limit failures; it does not determine your personal rating.

## Permission to use, publish, share and promote submitted materials

The representative must personally review and decide whether to accept the permission statement in the form. This preparation has not checked or accepted it.

## How likely are you to recommend the Meta Model API to another developer or engineering team building with LLMs?

Personal response required. Choose your own recommendation score.

## How likely are you to recommend Muse Code to another developer or engineering team?

Personal response required. If you did not use Muse Code, choose an available not-used/not-applicable option rather than inventing experience. The supplied field list does not show its available options.

## What was the biggest obstacle your team hit while building this project?

The hardest part was making the evidence independent of the model: executing candidate code with bounded capabilities, observing a real worker exit, distinguishing transaction-local writes from committed state, and recomputing imported reports. The lab also had to reject repairs that recover work by stealing a live claim. We kept the original adapter's fixture guard separate from the newer lifecycle adapter, where renewal and completion guards run inside the candidate methods.

## Compared with other AI models your team has used for the same kind of work, how did Meta's models perform on this project?

We did not run a controlled comparison against other model families. Within Muse Spark, we compared direct self-reviewed repair with repair using executed feedback under the same declared request/token ceilings. Across 12 attempted arms, feedback passed in 6/6 and direct in 4/6; failures and the post-hoc continuation remain disclosed. This supports the value of checking proposals in this small collection, not a cross-provider ranking.

## When your team chooses an AI model or coding tool, what matters most?

Suggested wording to confirm against your own priorities and the actual options:

Reliable tool calling, source-code reasoning and actionable execution feedback matter most for this workflow, followed by predictable cost, latency and clear error diagnostics. A plausible explanation is insufficient if the proposed source does not satisfy the independent contract.

Use that wording in “Please specify” only if it matches your selected option. Leave conditional follow-up fields blank when they do not apply.

## What makes it hardest for your team to switch to a different AI model or coding tool?

Suggested wording to review:

Revalidating structured-output and tool-call behavior, request limits, error handling and prompt compatibility would be the main switching work. RaceLab's executor, acceptance contracts and recorded regression checks are independent of model prose and could be reused to evaluate another integration. No cross-provider migration was measured in this project.

## If your team took this project to production, what would most likely stop you from using Meta's models?

Suggested wording to review:

Production adoption would depend on reliable tool-call behavior, actionable API errors, suitable rate limits and predictable cost and latency at the intended workload. We retained an HTTP 400 with no usage details and an output-capped attempt; clearer diagnostics and limit handling would help. We did not diagnose the HTTP 400 root cause or measure production-scale reliability, so these are adoption considerations rather than a claim of a confirmed provider defect.

## Before the final submit

Confirm the roster, actual dropdown choices, text limits and acceptance of the video URL. Review the personal ratings and permission statement yourself. Submit through https://cerebralvalley.ai/e/meta-ai-developer-hackathon/hackathon/submit and retain its confirmation. The public event page currently lists November 4, 2026 at 9 PM Eastern, equivalent to November 5 at 09:00 in Vietnam; recheck the portal if it announces a change.
