# v4.3.0-dev.1｜Canonical Integration Baseline

## GitHub × GPT 工作站同步狀態

- Product line: `v4.3.0`
- Current implementation baseline: `v4.3.0-dev.1`
- Schema: `13`
- Android package: `com.salarymate.personal`
- Android versionCode: `14`
- iOS MARKETING_VERSION: `4.3.0`
- iOS CURRENT_PROJECT_VERSION: `2`
- Canonical source SHA-256: `a2ffbb29e1e7b52ab6ca9dc9b30a975bcd384ec894b632b69177559ef36d08c4`

## Core diff audit

The workstation integration package preserves the following files byte-identical to the cross-platform source baseline:

- `NativeSalaryMateRepository.kt`
- `NativePayrollMath.kt`
- `src/storage.js`
- `src/snapshot-store.mjs`
- `src/backup-crypto.mjs`

`src/app.js` changes only the active product version identity from `4.2.0-dev.1` to `4.3.0-dev.1`.

## Important

CM / PAX / RI / RC / Stable items defined in GPT remain acceptance specifications until actual regression and real-device evidence exists.

This branch is **not** a Stable PASS declaration.
