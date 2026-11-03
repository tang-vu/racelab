# Security policy

## Supported versions

Security fixes target the current `main` branch and the public MVP at https://racelab.tangvu.dev/. Historical commits, archived films and frozen study artifacts are retained as evidence and are not maintained release branches.

This is an early MVP with best-effort maintenance. There is no guaranteed response or remediation time, and no formal security audit is claimed.

## Report a vulnerability privately

Use [GitHub private vulnerability reporting](https://github.com/tang-vu/racelab/security/advisories/new), also available through **Security → Advisories → Report a vulnerability**. Do not open a public issue containing an exploit, credential, private report or another person's source code.

Include:

- Affected commit or deployment, endpoint and approximate time.
- Impact and the smallest reproduction using synthetic data.
- Expected and observed behavior, with sanitized logs if useful.
- Any suggested mitigation and whether the issue is already public.

Do not include live API keys, session cookies, private accounting records or unrelated personal data. If you accidentally expose your own credential, revoke it with its provider promptly. Use public issues for ordinary bugs without sensitive security details.

## Areas of particular interest

- Candidate execution escaping its capabilities or execution limits.
- Cross-user access to retained source or reports, or origin/ownership checks being bypassed.
- Credentials reaching the browser, runner container, logs or exported evidence.
- Requests bypassing inference reservations, concurrency or usage limits.
- Imported source, reports or model responses executing in the page as HTML or script.

Reproduce suspected issues in a local checkout where possible. Do not access other users' data, exhaust the shared inference allocation, run denial-of-service tests or send destructive probes against the public service.

## Data and execution boundaries

Starting a new AI repair sends the supported source and execution feedback to Meta Model API. Use synthetic or authorized source; do not paste secrets. Browser projects are stored locally. Server-retained reports use browser-bound ownership and may remain available for up to 24 hours, subject to eviction. Export what you need to keep.

The public model key stays in an encrypted Cloudflare Worker Secret. Candidate execution uses bounded QuickJS/SQLite adapters and a separate runner container without internet or SSH. These safeguards do not establish that arbitrary code is safe or that a checked repair is correct outside its declared contract. See [MVP scope and storage](docs/live-mvp.md) and [hosting](docs/hosting.md).
