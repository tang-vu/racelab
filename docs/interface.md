# The RaceLab experience

The opening follows a studio portfolio rhythm: large, quiet typography, generous white space, a moving object and short chapters. The working lab remains one click away through **Open the lab** and a keyboard skip link. There is no forced introduction or loading animation. The current TEND video page shares the typography, header, theme and navigation transitions and includes eight seek/play chapter controls.

## From an object to an execution

The shared-memory sculpture is original CSS geometry with an SVG orbit, two request cards and bounded pointer tilt. Its visible memory, read copies, operation index and impact ratio come from the current local execution. The floating cards are decorative; their paths and positions do not claim to simulate the scheduler. Missing reads remain dashes, including repairs that use atomic operations instead of `get`.

Three scroll chapters select actual committed frames: the first relevant reads, a write and the final result. The board identifies original A or candidate B and the exact operation. An intermediate frame says REPLAY; only a final frame displays the independently computed PASS, FAIL or ERROR. The fixed denominator comes from the scenario inputs. Scrolling only selects data already in memory and never executes code or calls Meta. Editing source clears the presentation's stale run immediately.

Three experiment cards lead into the lab. Selecting a case executes one serial run and one controlled overlap locally. A browser view transition changes the lab when supported; ordinary case switching is the fallback. The same source, runner, contract and accounting are used beneath the new presentation.

## The working lab

A white source pane sits beside the dark execution stage. Request A uses clay, B uses periwinkle. Orange marks shared reads found in a failing trace. Pass/fail text and operation labels retain meaning without color. **Play**, the scrubber and timeline nodes select exact committed steps. **Find the collision** jumps to two requests reading the same relevant key/value without a write between them. This is an observed shared read, not a general causal inference engine.

**Check Meta repair** stays beside the trace. It recomputes the retained model investigation locally, then opens the candidate source and its checked execution. A/B preserves the editable original. Counts beside CHECKED and the evidence matrix retain the actual schedules, four inputs and complete/capped coverage. Actual/expected acceptance details expand in place. An unsuccessful candidate remains inspectable.

New paid investigations sit behind a separate disclosure with budget and data-flow copy. Saved replay refuses to overwrite modified source. Imported reports are recomputed; their model attribution remains unverified. Syntax highlighting escapes handler text before inserting spans. The presentation never evaluates model code.

## Motion and access

Text reveals use opacity, a small lift and blur; the opening lines unmask once. Hover arrows, case objects, a softly floating memory scene and sticky replay chapters provide motion without scroll hijacking or a custom cursor. Offscreen and hidden-page ambient animations pause. Scroll work is coalesced into animation frames; there is no continuous JavaScript rendering loop or external animation dependency.

**Pause motion** persists locally, stops ambient movement, removes reveals and smooth scrolling, and disables animated case changes. The operating system's reduced-motion preference takes priority. Light/dark choice also persists locally and changes only presentation. Anchor navigation transfers keyboard focus. Focus mode hides the introductory journey; Escape restores it. The narrow layout makes the replay board sticky above the chapters, lets experiment cards scroll horizontally, and keeps timeline/editor scrolling inside their own panes.

## References and assets

The user chose [Bearplus](https://bear.plus/). Its minimal monochrome palette, Google Sans Flex typography, restrained text reveals and responsive interactive objects informed the direction. Linked references inspected were [Heron AI](https://heronaiapp.com/), its [chat widget](https://heronaiapp.com/heron-chat-widget) and [dashboard](https://heronaiapp.com/heron-dashboard) pages, [Cargokite](https://cargokite.com/) and [Silana](https://www.silana.com/). Their product storytelling informed the scroll chapters and the shared design across the workbench and video page.

All RaceLab geometry and motion code was written for this interface. No reference-site images, mascots, JavaScript, CSS or animation libraries are distributed. The local Google Sans Flex subsets came from Google's official font API, with the OFL license and provenance in `public/fonts/`. Code remains monospace. No new runtime dependency, tracker or external font request was added.

## Verification and limits

The actual HTML/JavaScript runs in a DOM integration test against a separate keyless server. It covers auto-execution, actual sculpture and chapter values, theme/pause/reduced-motion controls, shared-read navigation, serial/search, recorded repair, A/B, stale-state clearing and escaping, replay refusal after edits, recomputed import, case switching, playback and Focus/Escape, with zero paid calls. Pure tests check chapter order, committed memory, no future read leakage, clamping and separate candidate verdicts. HTTP tests check the font MIME types, license and asset hashes.

Computer Use historically encountered capture timeouts and later a current-URL policy stop. On November 1 the user authorized an alternate method. Playwright with a fresh headless Microsoft Edge context now verifies real browser rendering at 1440, 768, 390 and 320 pixels. Review found a rotated decorative star expanding the landing page's mobile width; moving it inside the closing section fixes that overflow. TEND's smaller completion labels were enlarged. Page widths, reduced-motion behavior and offline playback pass the browser checks. DOM tests remain separate from visual evidence; timing on physical devices and an exhaustive animation/performance audit are not claimed.

The `/tend.html` workbench keeps the same typography, theme and clay/periwinkle source/trace treatment. Worker cards, process IDs, job generation, transaction timeline, local completion count and ten-condition matrix come from executed SQLite evidence. Original A stays editable; recorded recheck opens read-only B. SQL events do not advance committed memory before COMMIT. The page exports a regression report and a method diff for the verified source pin. Both the DOM integration tests and actual browser checks exercise A/B, theme, exported-file import, editing and stale-owner inspection. `docs/tend-shots/sources.json` binds the current captures to their hashes. The current film uses eight of those actual stills; the old eight screenshots and film remain archived. See [workload details](tend.md) and [film provenance](demo.md).
