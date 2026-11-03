# Contributing to RaceLab

RaceLab is a small developer workbench for reproducing asynchronous failures and checking model-generated repairs against independent execution contracts. Bug reports, accessibility feedback, documentation fixes and focused pull requests are welcome.

## Before opening an issue

- Search existing [issues](https://github.com/tang-vu/racelab/issues).
- Use a bug, feature or accessibility template and describe the smallest reproducible example.
- For suspected vulnerabilities, follow [SECURITY.md](SECURITY.md) instead of opening a public issue.
- Remove credentials, private source, cookies and personal data from reports and screenshots. Never attach `.env.local`, `.racelab/`, browser profiles or usage ledgers.

Please follow the [code of conduct](CODE_OF_CONDUCT.md). For changes to a workload contract, model provider, public hosting or evaluation design, discuss the intended behavior in an issue before implementing a large change.

## Local setup

Use Node.js 24.15+ LTS or 26+. No model key is needed for the default checks.

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run prepare:tend
npm run prepare:repositories
npm start
```

Open http://127.0.0.1:4174/. The prepare commands download pinned public inputs into ignored local storage and verify their identities. Preserve existing private configuration and accounting. See the [README](README.md) for the supported workflow and [source provenance](docs/provenance.md) for ownership boundaries.

## Making a change

1. Create a branch from `main` and keep the change focused.
2. Preserve frozen study recordings, source pins, archived films and their hashes. Label any new experiments separately.
3. Keep execution checks independent of model-generated source. Imported verdicts and attribution are not trusted evidence.
4. Update documentation when behavior, supported inputs or limits change.
5. Explain the problem, resulting behavior and relevant verification in the pull request.

Include a focused regression test for a behavioral bug when it demonstrates the failure. Documentation-only changes do not need new tests.

## Verification

```sh
npm test
npm run format:check
```

Run the applicable offline evaluations from the README when changing an executor, adapter, recording or film. The [CI workflow](.github/workflows/checks.yml) lists the full required checks. Browser checks additionally require an installed Microsoft Edge and a running local server; they use temporary contexts and block paid endpoints.

Default tests and evaluations do not call a model. Explicit live options can incur charges: do not run paid experiments merely to regenerate existing evidence, overwrite recordings, or reset accounting. Contributors should use their own authorized configuration and budget for any separately proposed live experiment.

## Pull requests and attribution

Describe reused source and third-party dependencies, including their licenses. Distinguish authored controls, model candidates and executed results. Do not claim that finite checks establish whole-application correctness or general model superiority.

RaceLab's original code is MIT-licensed; third-party components retain their own terms. See [LICENSE](LICENSE) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Do not submit code or assets you lack permission to contribute. Pull requests are reviewed on a best-effort basis; opening one does not deploy it.
