# Third-party components

RaceLab uses [quickjs-emscripten 0.32.0](https://github.com/justjake/quickjs-emscripten), by Jake Teton-Landis and contributors, under MIT. It packages QuickJS by Fabrice Bellard and Charlie Gordon, also MIT, as WebAssembly. The pinned npm packages contain their licenses. The runtime supplies the interpreter; RaceLab supplies the controlled store, schedules, contracts, experiment tools and interface.

Meta provides Muse Spark through its Model API. The existing chat integration and budget code were built during the same event for Tang Vu's earlier prototype; [source provenance](docs/provenance.md) identifies that reuse.

Prettier 3.9.10 is a development dependency under MIT, used for formatting. Its npm package includes its license.

The offline recording workflow uses separately installed FFmpeg and Microsoft Zira speech synthesis for generic English narration. Segoe UI is read from the recording machine for rasterized text. Those binaries, voice files and font are not distributed. The bundled movie contains actual application screenshots paced as stills and captions. No Three.js, Mediabunny or Meta SAM parser is bundled or required.
