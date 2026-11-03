# Judge readiness and accessibility checks

## Public readiness

```sh
npm run check:judge
```

This checks anonymous access to the MVP, film, store experiments, recorded explorer, separate review page, public GitHub repository and YouTube metadata. It checks Muse Spark 1.3's public availability status and a 32-byte movie range. It does not start a model investigation, execute a workload, read a historical ledger or use an API key. YouTube metadata is not decoded playback verification.

The result is saved locally in ignored `.racelab/judge-readiness/latest.json`. Failed checks return a nonzero exit status. A temporary busy/rate-limited client state is reported separately from model configuration, accounting-review or exhausted-budget failures. The public status does not disclose the private balance; a maintainer must review that separately. This check never resets accounting, raises limits or retries inference.

The [Judge readiness workflow](../.github/workflows/judge-readiness.yml) runs at minute 17 every six hours and can be started manually from Actions. Results appear in its job summary; notifications follow the viewer's GitHub settings. Scheduled execution can be delayed by GitHub, so this is a periodic check without an uptime guarantee. After November 10, 2026 at 00:00 UTC, the next scheduled run disables this workflow. Its `actions: write` permission is used only for that self-disable step; checks require no model secret. A maintainer can re-enable it later if needed.

## Keyboard and automated accessibility review

Start a keyless local judge server, then run the review in another terminal:

```sh
node scripts/serve-judge.mjs
npm run check:accessibility
```

The review uses `playwright-core`, an installed Microsoft Edge and pinned `axe-core`. It blocks paid endpoints and external page requests. Local overrides use `RACELAB_BASE_URL`; a public HTTPS origin additionally requires `RACELAB_PUBLIC_CHECK=1`.

The review exercises:

- Skip-link focus, keyboard project naming and browser-local saves.
- Manual A/B tab activation with arrows, Home/End and Enter, one tab stop and named source panels.
- Focus preservation when a trace redraws.
- A named import dialog, forward/reverse focus wrapping, an in-dialog parse error, Escape and focus return.
- Original, candidate and dialog states, light/dark themes, and a 320 CSS-pixel layout check.
- Chromium accessibility-tree names and roles for source tabs, panel and editor, plus a persistent execution-result status.

On November 3, thirteen axe scans passed with no detected violations across the tested MVP/store/explorer/film/evaluation states. The report retains axe's incomplete checks for manual review. Reports, an accessibility-tree snapshot and a narrow screenshot stay in ignored `.racelab/accessibility/`; no private projects are used.

These are browser, semantic and automated checks. No native NVDA/Narrator/VoiceOver speech test, exhaustive WCAG audit or conformance certification is claimed. See [known accessibility limitations](../ACCESSIBILITY.md).
