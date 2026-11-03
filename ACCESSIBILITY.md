# Accessibility

RaceLab aims to make its source comparisons, execution evidence and repair checks usable with different input methods, display sizes and motion preferences. Accessibility feedback and focused fixes are welcome.

## Available features

- A skip link on the main workbench, labeled controls and visible keyboard focus.
- Text labels for PASS, FAIL and ERROR, alongside color and visual traces.
- Original/candidate source and actual/expected values that can be inspected as text.
- Light and dark themes, responsive layouts and support for the operating system's reduced-motion preference. The store experience also has a persistent **Pause motion** control.
- English captions and chapter controls in the [hosted demo player](https://racelab.tangvu.dev/film.html). The caption text is available as [WebVTT](public/racelab-demo.vtt) and [SRT](demo/racelab-demo.srt).

## Environments and verification

Actual-browser checks have used Microsoft Edge on Windows at 1440, 768, 390 and 320 CSS-pixel viewport widths, including reduced motion and both themes. Mobile widths are browser emulation, not physical-device certification. The workbench requires JavaScript and a modern browser with WebAssembly support. Live execution requires a network connection; browser project saves require local storage.

On November 3, the focused keyboard review covered the skip link, project naming/save, original/candidate tabs, source access, trace activation and an import dialog with errors, focus containment, Escape and focus return. Thirteen axe scans of the MVP, store experiments, recorded explorer, film and evaluation pages, including both themes and additional candidate/dialog states, returned zero automated violations. Chromium's accessibility tree exposed named source tabs, a labeled panel/editor and a persistent result status. [Repeat the review](docs/judge-readiness.md).

Other browser/OS combinations may work but have not received the same verification. Automated DOM, axe and browser checks cover selected interactions; they are not a comprehensive accessibility audit. No WCAG conformance level or screen-reader compatibility certification is claimed.

## Known limitations

- Dense code, SQL and process traces can require scrolling within their own panes on narrow screens. The visual trace is accompanied by textual events and checks.
- Native screen-reader speech and navigation with NVDA, Narrator or VoiceOver have not been verified. Accessibility-tree checks do not establish that those combinations work correctly.
- Keyboard verification covers the documented workflows; broader assistive-technology testing remains welcome. Contrast checks cover the scanned states, and zoom behavior has not undergone an exhaustive audit.
- The interface and current demo captions are in English. Narration is synthetic; the caption files provide a text alternative.

## Report a barrier

Open an [accessibility report](https://github.com/tang-vu/racelab/issues/new?template=accessibility.yml). Include the page, task, browser/OS, input method or assistive technology, and the behavior that blocked you. If comfortable, suggest an alternative that would help. Do not include medical details, credentials or private project source.

Reports are reviewed on a best-effort basis. If the report includes a vulnerability or private data exposure, use [private security reporting](SECURITY.md) instead.
