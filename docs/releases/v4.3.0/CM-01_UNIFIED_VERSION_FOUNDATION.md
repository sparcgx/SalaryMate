# CM-01｜Unified Version Foundation

Status: **TARGETED GATE PASS**

- Product: `4.3.0-dev.1`
- Release target: `4.3.0`
- Schema: `13`
- Android versionCode: `14`
- iOS build: `2`
- Human-maintained version source: `version.json`
- Version Drift: `0`

## Implemented

- Added `scripts/version-contract.mjs`
- Added `scripts/sync-version.mjs`
- Added `scripts/version-drift-test.mjs`
- Added npm `version:sync` / `version:check`
- Removed stale `4.2.0-dev.1-debug` formal-device expectation
- Removed stale Android `versionCode 13` build checks
- Preserved Windows batch ASCII + CRLF contract

## Targeted regression

`16 PASS / 0 FAIL`

Core isolation:
- NativeSalaryMateRepository: SAME
- NativePayrollMath: SAME
- storage.js: SAME
- snapshot-store.mjs: SAME
- backup-crypto.mjs: SAME
- app.js core: SAME

## Environment limitation

The current GPT execution container cannot complete locked npm dependency installation for the legacy `ios-foundation-test.mjs` because the `xcode` npm dependency is unavailable in the local cache. This is recorded as **PENDING_ENVIRONMENT**, not a product FAIL. iOS version identity is directly covered by the CM-01 drift gate.

Full CM-02～CM-06 and RC/Stable remain PENDING.
