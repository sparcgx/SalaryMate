# v4.3.0-dev.1｜Canonical Integration Baseline

## GitHub × GPT 工作站同步狀態

- Product line: `v4.3.0`
- Current implementation baseline: `v4.3.0-dev.1`
- Schema: `13`
- Android package: `com.salarymate.personal`
- Android versionCode: `14`
- iOS MARKETING_VERSION: `4.3.0`
- iOS CURRENT_PROJECT_VERSION: `2`

## Canonical source chain

Initial canonical baseline SHA-256:

`a2ffbb29e1e7b52ab6ca9dc9b30a975bcd384ec894b632b69177559ef36d08c4`

CM-01 R1 source SHA-256:

`e27adfb5dfbbd0224bbcc6d763211a60991e8d474c5650f77a5ae27d3472ccd9`

## CM-01｜Unified Version Foundation

**Targeted Gate: PASS — 16 PASS / 0 FAIL**

- `version.json` is the single human-maintained version source.
- Web / Shared / Android / iOS version bindings are synchronized.
- Version Drift: `0`.
- Stale formal-device `4.2.0-dev.1-debug` expectation removed.
- Stale Android `versionCode 13` build checks removed.
- Windows batch ASCII + CRLF contract preserved.

Full npm regression remains `PENDING_ENVIRONMENT` at the legacy iOS Foundation parser test because the current execution environment cannot install the locked `xcode` npm dependency. This is not recorded as a product failure.

## Core isolation audit

Byte-identical to the Canonical Integration baseline:

- `NativeSalaryMateRepository.kt`
- `NativePayrollMath.kt`
- `src/app.js`
- `src/storage.js`
- `src/snapshot-store.mjs`
- `src/backup-crypto.mjs`

## Remaining v4.3.0-dev.1 work

- CM-02 Company Management Shell: PENDING
- CM-03 Simplified Salary Rules: PENDING
- CM-04 Advanced Company Rules: PENDING
- CM-05 Workflow / Cross-Platform UX: PENDING
- CM-06 Full Regression / dev.1 Freeze: PENDING

PAX / RI / RC / Stable remain acceptance specifications until actual implementation and evidence exist.

This branch is **not** a Stable PASS declaration.
