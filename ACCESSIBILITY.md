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

Other browser/OS combinations may work but have not received the same verification. Automated DOM and browser checks cover selected interactions; they are not a comprehensive accessibility audit. No WCAG conformance level or screen-reader compatibility certification is claimed.

## Known limitations

- Dense code, SQL and process traces can require scrolling within their own panes on narrow screens. The visual trace is accompanied by textual events and checks.
- A full keyboard-only and screen-reader audit, including dynamic announcements, dialogs and source-pane navigation, remains outstanding.
- Contrast and zoom behavior have not undergone an exhaustive accessibility audit.
- The interface and current demo captions are in English. Narration is synthetic; the caption files provide a text alternative.

## Report a barrier

Open an [accessibility report](https://github.com/tang-vu/racelab/issues/new?template=accessibility.yml). Include the page, task, browser/OS, input method or assistive technology, and the behavior that blocked you. If comfortable, suggest an alternative that would help. Do not include medical details, credentials or private project source.

Reports are reviewed on a best-effort basis. If the report includes a vulnerability or private data exposure, use [private security reporting](SECURITY.md) instead.
