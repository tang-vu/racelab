# Current evidence demo

Watch the [public three-minute player](https://racelab-tang-vu.tang-vu.chatgpt.site), or open `http://127.0.0.1:4174/film.html` after `npm start`. The November 2 film is 179.904 seconds, 1920x1080 at 30 fps. Four new Edge interaction clips and four stills are framed with fixed close-ups, original graphics and a restrained synthesized sound bed. Xiaomi MiMo's built-in English Mia voice replaces the earlier Zira narration. No voice cloning is used.

| Start | Scene                                                                                           |
| ----- | ----------------------------------------------------------------------------------------------- |
| 00:00 | A passing test, a missing job, the original failure and checked repair; event/input attribution |
| 00:20 | Pinned source, a real worker and a database that survives its exit                              |
| 00:42 | The committed trace and the explicit sixty-second recovery contract                             |
| 01:06 | Meta's hypothesis, executed crash probe, candidate source and independent checks                |
| 01:31 | Challenge recovery with contention, renewal and stale ownership                                 |
| 01:55 | Additional source controls and retained failures                                                |
| 02:17 | Every attempted comparison arm and the disclosed continuation                                   |
| 02:40 | Inspect online, recompute locally, export and challenge the regression                          |

The public explorer displays retained evidence. It does not execute SQLite or call a model. The local workbench re-executes the unchanged original Meta proposal. The film is edited; preparation and model waiting are omitted. Camera crops stay fixed within each scene; the video adds no slow zoom or pan to the application. Genuine clicks, scrolling and replay changes remain. Graphic summaries do not alter source, verdicts or receipts. The bounded adapters do not establish whole-application correctness or external-delivery guarantees.

## Speech and captions

The media workflow uses official [MiMo TTS](https://mimo.mi.com/docs/en-US/quick-start/usage-guide/audio/speech-synthesis-v2.5) and [MiMo ASR](https://mimo.mi.com/docs/en-US/quick-start/usage-guide/audio/Speech-Recognition). The repair model remains Meta Muse Spark. Only the public narration text and synthesized audio go to MiMo; application credentials, the Meta ledger and private source are not sent.

Each selected speech beat was synthesized and transcribed separately. The complete final audio mix also passed an ASR review. `demo/racelab-speech.json` retains the selected texts, unedited ASR output, audio hashes and caption bounds. Captions retain authored spelling of names such as TEND and airules; ASR's proper-name differences and occasional list-prefix artifacts remain visible in the raw transcript. Times come from actual trimmed speech clips, normalization and bounded tempo adjustment, not fabricated provider word timestamps or uniform word spacing. This is phrase-level alignment, not a claim of phoneme-perfect forced alignment.

The final mix measures approximately -16.34 LUFS integrated and -3.94 dBTP using FFmpeg loudness analysis. The bed is generated from elementary oscillators by the renderer, with no sampled commercial music. Media iterations are separate from frozen repair experiments; they do not rerun, replace or select repair outcomes. MiMo's separate media credential and request records remain private, with no automatic transport retry.

## Provenance and archives

`demo/racelab-storyboard.json` and `demo/racelab-film-v4.json` retain the script and editorial plan. `demo/racelab-render-manifest.json` binds final video, source captures, narration, camera crops, dimensions and decoded frames. New source clips/stills and their registry are in `docs/film-shots/`, captured in fresh keyless Edge contexts at 1440x900 with paid endpoints blocked. No generated application mockups or invented execution evidence are used.

All four earlier movies are byte-preserved:

- `public/archive/racelab-evidence-zira-demo.mp4`: the full comparison film immediately before this MiMo rebuild; exact metadata/captions/poster are `demo/archive/evidence-zira-*`, with unchanged sources in `docs/evidence-shots/`.
- `public/archive/racelab-evidence-partial-demo.mp4`: the film before the disclosed continuation.
- `public/archive/racelab-tend-demo.mp4`: the earlier TEND stills film.
- `public/archive/racelab-store-demo.mp4`: the original store experiment film.

The opening credits new RaceLab work by Tang Vu and earlier TEND/event inputs. Authored lifecycle controls remain separate from Meta candidates. All twelve planned comparison arms were attempted once across the stopped amended study and disclosed post-hoc continuation. Original setup, truncation and invalid-SQL failures remain. This small collection is not a general superiority result or human-feedback study.

## Verify and rebuild

`npm run check:film` verifies the current movie, selected speech/caption bounds, source hashes, original investigation and all four archives without network or model calls. `npm run check:browser` checks actual local playback, all eight chapters and the keyless workbench. `npm run check:evidence` checks the recorded explorer/evaluation. These default checks do not regenerate media or make paid requests.

Rebuilding is a separate media-production action. It requires installed FFmpeg, Python with Pillow, and the npm development dependencies. On this Windows capture machine:

```powershell
$env:RACELAB_BASE_URL = 'http://127.0.0.1:4188'
node scripts/capture-film-v4.mjs
# Explicit MiMo operation; provide a separate key via environment or hidden stdin.
node scripts/narrate-mimo.mjs --live --out=.racelab/film-mimo-fresh
# Review every retained ASR transcript before choosing the speech file.
python scripts/render-film-v4.py --speech .racelab/film-mimo-fresh/speech.json
npm.cmd run check:film
```

The currently selected speech takes remain in ignored local storage; no key, private request ledger, raw WAV collection or installed font is bundled. Captions use measured clip boundaries. A fresh synthesis is nondeterministic and needs review; do not claim that it recreates identical audio bytes. The legacy `render-demo.mjs` is retained for archived storyboards and refuses the current v4 format. No competition submission or LAN deployment is part of media preparation.
