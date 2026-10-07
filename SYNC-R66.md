# SalaryMate R66 sync

- Sites source commit: 95fb31bda6e16027f92b86a8feeb31efe6da92a1
- Version: 5.0.0-dev.2-R66
- Existing development path: /dev/v5.0.0-dev.2/
- Source mirror: sites-source/ (generated dist/server/index.js can be rebuilt with scripts/build-stock-worker.mjs)
- New personal Fugle index connection uses a session-only API key and direct provider requests.
- Intraday chart, actual quote timestamp, daily change, index selector, and collapsed holdings controls.
- 31 native tests, JavaScript syntax, worker build, portable CSP hashes and frozen-page release checks passed.
- Authorized real-time provider delivery and physical phone visual acceptance remain unverified without the user's key/device.
- Schema 15 and salarymate_v5_full_state unchanged. Frozen v4.3.2 preserved.
