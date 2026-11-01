# Source provenance

RaceLab was built by Tang Vu during the Meta Global AI Developer Hackathon, starting October 29, 2026. The standalone repository is a selective extract of RaceLab work from the earlier hackathon checkout at revision `fa90112`. It starts a fresh Git history and contains no LiveWorld or Kept application, segmentation code, 3D renderer, world simulator or their assets/dependencies.

## RaceLab implementation

- `src/race/`: controlled store-operation scheduling, isolated QuickJS execution, fixed independent contracts, Meta experiment/patch tools, bounded verification and replay.
- `public/`: RaceLab editor, trace timeline, A/B source, recorded/live tool feedback, checks and report import/export.
- The October 30 interface adds original CSS geometry, trace-driven scroll chapters and browser-native transitions. Bearplus and linked product sites were user-selected visual references, identified in `docs/interface.md`. The redistributed font is Google Sans Flex under OFL 1.1, with its license and source manifest; reference-site assets and scripts are excluded.
- `demo/`, `docs/racelab-shots/`: predeclared study, actual retained model outputs, edited-source integration check, movie transcript and capture provenance.
- `src/workloads/`, `/tend.html`: the October 30 TEND adapter, disposable SQLite/process harness, fixed recovery contract, probe/patch tools, recomputed reports and method-diff export. TEND's pinned method and mapper are pre-existing MIT inputs. RaceLab adds the 60-second lease policy and fixed generation-guarded fixture completion; it does not run or repair the full TEND application. [Workload provenance and limits](tend.md).

## Reused event infrastructure

- `src/meta.mjs`: the Muse Spark chat transport from the earlier LiveWorld event prototype, reduced to chat only. Image editing, SAM segmentation and their adapters were removed.
- `src/budget.mjs`: persistent reservations, settlement, conservative uncertain-charge handling and file locking. Existing accounting is preserved privately; it is not included in this repository.
- `src/access.mjs` and `server.mjs`: host/origin guards, optional access sessions, static serving, video ranges and SSE patterns, reduced to the RaceLab application.
- The film renderer and Windows launcher were adapted from the earlier event workflow. Relevant accounting, access and chat tests were retained.

QuickJS/quickjs-emscripten is third-party runtime software. Meta supplies Muse Spark; RaceLab does not claim to have built or trained those components. See [third-party notices](../THIRD_PARTY_NOTICES.md).

The current bundled movie was rebuilt November 1 around the TEND workbench. Its actual Microsoft Edge screenshots were captured through Playwright in a fresh local context, with finite CSS transitions settled for stills. They are in `docs/tend-shots/`; `sources.json` records browser version, viewport, capture method and SHA-256. The retained Meta investigation was replayed rather than repeated. Microsoft Zira supplies generic English narration; FFmpeg encodes the movie. The opening identifies new RaceLab work, reused infrastructure and TEND as a pre-existing input.

The earlier movie is retained byte-for-byte at `public/archive/racelab-store-demo.mp4`, with original captions/poster and storyboard/render metadata in `demo/archive/`. Its eight screenshots remain unchanged in `docs/racelab-shots/`. They predate extraction and contain historical navigation. Neither film is continuous live footage or a production benchmark.

No GitHub remote, upload, deployment, submission or organizer message was created during the extraction. Prior work is credited rather than represented as newly authored for this extraction.

On November 1, after the user authorized pre-submission publication, the standalone repository was pushed to [tang-vu/racelab](https://github.com/tang-vu/racelab). A separate [public review Site](https://racelab-tang-vu.tang-vu.chatgpt.site) hosts byte-identical video/evidence assets and local reproduction links. It reuses the project's existing film styles, chapters and fonts, with small theme/media-loading scripts. The complete Node/SQLite workbench is not deployed by that static Site. No competition submission or organizer communication was performed.
