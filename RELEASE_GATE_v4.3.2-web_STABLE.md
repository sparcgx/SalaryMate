# SalaryMate v4.3.2 Web Stable / Freeze

Promotion authorized by the user on 2026-09-30: 「網頁版晉升 Stable」.

## Scope and baseline

Web / PWA only. Runtime version: `4.3.2`; release ID: `4.3.2-web`.
Accepted RC.3 Sites source: `c5e4e26e14cf04fcc5c1da6effd58363e2a4af83`.
Accepted RC.3 GitHub source: `81b8f2861549b0c107b3ca1c5471a2e99e59f373`.
All 27 runtime assets match RC.3 after normalizing the formal version identifier. No business logic or layout changes accompany this promotion.

## Included features and fixes

- Monthly salary reconciliation and preview before copying the previous month.
- Compensatory leave source, balance, expiry and settlement.
- Year-to-date comparison, income structure and integrated reporting.
- RC.2 data/import integrity, CSV safety, annual caching and search improvements.
- RC.3 compact mobile salary search toolbar and horizontal reconciliation/edit/delete buttons.

## Acceptance and evidence

- Latest user report: PASS for RC.3 search toolbar height and horizontal action buttons.
- Earlier dev milestone PASS reports remain user-reported evidence, not native automation results.
- Stable automation: 61 tests PASS, 0 FAIL; 6 source gates PASS.
- Evidence: `release-evidence/v4.3.2-web_results.json`, `v4.3.2-web_test.log`, `v4.3.2-web_freeze.json`.
- Reproduce from Sites source: `npm run test:stable`.
- Historical RC scripts and evidence belong to their corresponding frozen revisions.

## Release and freeze policy

Production site: https://salarymate.sparcgx2420.chatgpt.site
GitHub: sparcgx/SalaryMate; release branch `release/v4.3.2-web`, target `main`.
Stable and freeze snapshots: `stable/v4.3.2-web`, `freeze/v4.3.2-web`.
Preserve previous freeze snapshots. Subsequent functionality or fixes require a new version.

## Native gates excluded from Web Stable

Android Gate: UNVERIFIED.
iOS Gate: UNVERIFIED.
Native fault injection: UNVERIFIED.
Original/native data-safety BLOCKER: OPEN.
Web Stable promotion does not close these gates or certify native packages.
