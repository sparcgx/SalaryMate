# R100 web validation — 2026-10-10

Existing development routes only:
- https://salarymate.sparcgx2420.chatgpt.site/dev/v5.0.0-dev.2/
- https://sparcgx.github.io/SalaryMate/dev/v5.0.0-dev.2/

Sites source baseline: `c6bad00254848d4471a0daf96aa5118f33ba9e3f`, project `appgprj_6aa0d52f0f308191b5f325b9a8e004e4`. Pages baseline: `eea10ab218c1b72216fda0fca2014dfb054807c3`, deployment branch `stable/v4.2.0-web`. Existing public audience and v4.3.2 root remain unchanged. Android R100 work and APK are separate and were not modified.

## Changes
- Google Identity load failures/offline state now explain the disabled connection button and offer retry. Timed-out, cancelled and stale authentication responses cannot revive or clear another session.
- Drive request timeouts and disconnect cover response bodies; upload completion is checked against the current session. Closing auto-save setup cannot enable automatic saving afterward. Snapshot errors report visibly and release the operation lock. UTF-8 download sizes reuse the streaming byte count.
- Early startup errors retain the readable shell and expose explicit reload. CSS errors, including a transient pre-existing CSSOM sheet followed by failure observed in Chrome, keep the fallback and allow CSS-only retry. Ready application controls and saved data are retained; SVG fallback sizes are bounded. No automatic page reload was added.
- Restore checks company/overtime/compensatory-time references and the candidate's derived compensatory-time ledger before writing. Historical income source IDs remain valid after payroll deletion. Schema 15, storage keys and encryption format are unchanged.
- Hosted and portable CSP explicitly hash the early guard without allowing arbitrary inline scripts. Hashes follow HTML newline normalization, including Windows CRLF. Locale generation and the R93 export test accept Windows newlines.

## Executed checks
- Source backup/startup/leave regressions: **45/45 passed**.
- Final portable backup/startup/leave plus publication checks: **50/50 passed** (includes five publication tests).
- Drive portable integration: **11/11 passed**, including file-origin guidance, English UI, controlled OAuth/403 failures, encrypted backup and cancellation. No real Google account authorization was performed.
- Drive lifecycle, security, storage, offline cache and startup/style-pack regressions: **80/80 passed**.
- Worker and portable builds passed. Syntax checks and `git diff --check` passed. This project defines no lint command.
- Project `npm test`: **57 passed, 4 failed** in the unchanged `stable432-freeze-pwa` suite. These are the same frozen-file-list/cache expectations already reproduced on untouched R99; the chained stable site gate is not run after that failure. Do not report the full npm suite as green.
- Pages frozen-file verification: all 55 tracked files outside `dev/v5.0.0-dev.2/index.html` retained their original bytes and modes.
- Dependency audit still reports one existing development-only `source-map-js` advisory; no dependency update was included.

## Real Chrome checks and limits
On a separate localhost origin, created a synthetic company and a 39,000 payroll through the UI, navigated/reloaded, and confirmed the data remained. Forced CSS HTTP 503, observed the visible recovery message, clicked CSS retry and verified the full UI and same payroll. Forced startup JavaScript HTTP 503 and verified a readable error and reload button. The browser-control confirmation API timed out during the explicit reload confirmation, so that complete interaction is not claimed as a browser pass; its cancellation/retry logic is covered by automated tests.

The unconfigured Google panel displays setup guidance and does not initiate OAuth. A synthetic JSON backup was downloaded and checked. File-chooser upload is blocked by the browser extension's file-URL access setting, so actual Chrome file import/roundtrip remains unverified; automated DOM backup/Drive roundtrips passed. No user payroll, Google credentials, permissions or production storage were altered during QA.

Detailed local evidence is under the task's `evidence/` directory: `web-r100-backup-startup.log`, `web-r100-drive-integration.log`, `web-r100-release-regression.log`, `web-r100-npm-test.log`, `web-r100-publication.log`, and `pages-frozen-baseline.json`. Deployment success is recorded separately after publication; this source document does not itself assert deployment.
