# Third-party components

RaceLab uses [quickjs-emscripten 0.32.0](https://github.com/justjake/quickjs-emscripten), by Jake Teton-Landis and contributors, under MIT. It packages QuickJS by Fabrice Bellard and Charlie Gordon, also MIT, as WebAssembly. The pinned npm packages contain their licenses. The runtime supplies the interpreter; RaceLab supplies the controlled store, schedules, contracts, experiment tools and interface.

Meta provides Muse Spark through its Model API. The existing chat integration and budget code were built during the same event for Tang Vu's earlier prototype; [source provenance](docs/provenance.md) identifies that reuse.

The repository-workload input includes `claimNextDue` from [TEND](https://github.com/tang-vu/tend/blob/fe6975ced2c2004e3bb8f91e97c07db878596a06/packages/db/src/store.ts), pinned at `fe6975ced2c2004e3bb8f91e97c07db878596a06`, under MIT, copyright 2026 TEND contributors. The [complete license](public/licenses/TEND-MIT.txt) accompanies the source excerpts in the retained recording and the verified source cache. TEND is pre-existing input. RaceLab's adapter, interruption harness, recovery contract, Meta tools and interface are new work; TEND application features are not claimed as RaceLab contributions. The adapter uses Node's built-in SQLite driver, not the complete TEND runtime.

The additional owned public inputs are pinned in `demo/repository-inputs.json`. airules `diffSync` is MIT, copyright 2026 Tang Vu; its [complete license](public/licenses/AIRULES-MIT.txt) is retained. OpenMusic project/workspace source is author-selected public input downloaded into the ignored cache; no upstream license file was found at the inspected revision and RaceLab does not relicense it. Neither repository's application features are new RaceLab work. [Exact adapters and results](docs/evaluation.md).

Prettier 3.9.10 is a development dependency under MIT, used for formatting. Its npm package includes its license.

[playwright-core 1.64.1](https://github.com/microsoft/playwright) is a development dependency under Apache-2.0, used for local browser checks and captures with an installed Microsoft Edge. It is not shipped to the application browser. Its npm package includes its license and notices. Microsoft Edge and browser binaries are not distributed.

[jsdom 30.1.3](https://github.com/jsdom/jsdom) is a development dependency under MIT, used to exercise the actual workbench HTML and JavaScript against a keyless local test server. It is not shipped to the browser and does not provide visual rendering or screenshot verification.

[Google Sans Flex](https://github.com/google/fonts/tree/main/ofl/googlesansflex) is distributed under the SIL Open Font License 1.1. The local Latin and Vietnamese WOFF2 subsets came from Google's Fonts API. Their source URLs, byte counts and SHA-256 hashes are in `public/fonts/font-origin.json`; the complete license is in `public/fonts/OFL-Google-Sans-Flex.txt`. Font loading makes no external request. Code uses the system's installed monospace fonts.

The user selected [Bearplus](https://bear.plus/) and its project sites as visual references. RaceLab's memory sculpture, SVG paths, layout implementation and vanilla JavaScript motion are original project work. No Bearplus, Heron AI, Cargokite or Silana mascot, image, animation bundle or site code is included. See [design references](docs/interface.md).

The offline recording workflow uses separately installed FFmpeg and Microsoft Zira speech synthesis for generic English narration. Segoe UI is read from the recording machine for rasterized text. Those binaries, voice files and font are not distributed. The current movie combines actual Microsoft Edge interaction recordings with application stills and captions. Both earlier stills films remain archived. No Three.js, Mediabunny or Meta SAM parser is bundled or required.
