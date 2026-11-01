# Current TEND demo

Open `http://127.0.0.1:4174/film.html` after `npm start`. The current film is `public/racelab-demo.mp4`; it includes generic Microsoft Zira English narration, English subtitles and eight chapter controls in the player. The film uses actual application screenshots paced as stills, with model/recheck waiting time omitted. It is not continuous screen recording.

| Start | Scene                                                              |
| ----- | ------------------------------------------------------------------ |
| 00:00 | Saved job, stopped worker; new/reused work disclosure              |
| 00:24 | Original method completes uninterrupted work                       |
| 00:44 | Kill after the committed claim; replacement process cannot recover |
| 01:07 | Retained Meta candidate re-executes locally and recovers           |
| 01:34 | Ten declared conditions and independent acceptance checks          |
| 01:58 | Old generation rejected by the fixed local completion guard        |
| 02:20 | Actual exported regression opened through the file picker          |
| 02:42 | Method, adapter, lease-policy and external-effect boundary         |

## Evidence and authorship

`demo/racelab-storyboard.json` contains the exact transcript, timings and disclosures. `demo/racelab-render-manifest.json` records media geometry, duration, decoded frames, screenshot hashes, narration hashes, voice, tempo and retained-investigation hash. `docs/tend-shots/sources.json` records the actual browser version, viewport, capture method and review results. Scene PNGs are actual screenshots, not generated UI mockups. CSS transitions were settled when taking stills.

The source is the existing MIT TEND method at its verified pin. RaceLab's adapter, interruption harness and 60-second lease contract are new work. The completion-generation guard is fixed RaceLab fixture instrumentation, not a repair of upstream completion or proof of exactly-once external effects. The retained Muse Spark investigation used two requests and one candidate; offline capture made no new model call. The recording remains byte-identical at SHA-256 `91e2b1ffc0d4ac3940d537b5a7552f15977905743a3480eadfcc8b090480baee`.

The earlier store-experiment video is byte-preserved at `public/archive/racelab-store-demo.mp4`. Its captions/poster accompany it; original storyboard, manifest and SRT are in `demo/archive/`. Old screenshot hashes still verify against `docs/racelab-shots/`.

## Reproduce locally

Run `npm run check:browser` with the local server and installed Microsoft Edge. Playwright uses a fresh headless context and blocks paid endpoints and external page requests. It saves actual screenshots and a source registry under ignored `.racelab/browser-review/`. The script verifies A/B, ten conditions, stale-owner inspection, file export/import, edited-source invalidation, theme, playback, reduced motion and widths of 1440, 390, 320 and 768 pixels. Phone checks use viewport emulation, not physical devices. Browser QA does not claim exhaustive performance or animation timing coverage.

To rebuild, copy the eight reviewed scene PNGs and their `sources.json` into an ignored capture directory. On Windows, `node scripts/narrate-demo.mjs` generates local narration WAVs under `.racelab/film-tend/` with the installed speech API and leaves system settings unchanged. Use an installed FFmpeg:

```powershell
$env:RACELAB_FFMPEG_DIR = 'D:\Apps\FFmpeg-9.0.2\bin'
node scripts/render-demo.mjs .racelab/film-tend
npm.cmd run check:film
```

The renderer rejects changed source hashes or narration needing more than 1.16x tempo, checks final video geometry/timing/audio/subtitle tracks, and then promotes the movie and captions. WAVs, intermediate media and the local font stay ignored. The checker verifies the retained investigation and archive too. No upload, hosting, competition submission or production integration is part of this workflow.
