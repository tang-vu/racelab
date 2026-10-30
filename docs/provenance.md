# Source provenance

RaceLab was built by Tang Vu during the Meta Global AI Developer Hackathon, starting October 29, 2026. The standalone repository is a selective extract of RaceLab work from the earlier hackathon checkout at revision `fa90112`. It starts a fresh Git history and contains no LiveWorld or Kept application, segmentation code, 3D renderer, world simulator or their assets/dependencies.

## RaceLab implementation

- `src/race/`: controlled store-operation scheduling, isolated QuickJS execution, fixed independent contracts, Meta experiment/patch tools, bounded verification and replay.
- `public/`: RaceLab editor, trace timeline, A/B source, recorded/live tool feedback, checks and report import/export.
- The October 30 interface adds original CSS geometry, trace-driven scroll chapters and browser-native transitions. Bearplus and linked product sites were user-selected visual references, identified in `docs/interface.md`. The redistributed font is Google Sans Flex under OFL 1.1, with its license and source manifest; reference-site assets and scripts are excluded.
- `demo/`, `docs/racelab-shots/`: predeclared study, actual retained model outputs, edited-source integration check, movie transcript and capture provenance.

## Reused event infrastructure

- `src/meta.mjs`: the Muse Spark chat transport from the earlier LiveWorld event prototype, reduced to chat only. Image editing, SAM segmentation and their adapters were removed.
- `src/budget.mjs`: persistent reservations, settlement, conservative uncertain-charge handling and file locking. Existing accounting is preserved privately; it is not included in this repository.
- `src/access.mjs` and `server.mjs`: host/origin guards, optional access sessions, static serving, video ranges and SSE patterns, reduced to the RaceLab application.
- The film renderer and Windows launcher were adapted from the earlier event workflow. Relevant accounting, access and chat tests were retained.

QuickJS/quickjs-emscripten is third-party runtime software. Meta supplies Muse Spark; RaceLab does not claim to have built or trained those components. See [third-party notices](../THIRD_PARTY_NOTICES.md).

The bundled movie and original eight source screenshots are retained byte-for-byte with their original hashes. They were captured before this repository extraction and contain historical navigation to the earlier application. The current workbench contains only RaceLab. Captures are evidence of the running prototype, not continuous live footage or a production benchmark.

No GitHub remote, upload, deployment, submission or organizer message was created during the extraction. Prior work is credited rather than represented as newly authored for this extraction.
