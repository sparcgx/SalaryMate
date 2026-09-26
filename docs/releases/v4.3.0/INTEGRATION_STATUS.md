# v4.3.0-dev.1｜Development Source Freeze

## Decision
- Development Source Freeze: **PASS**
- Full Platform Build / Device Gate: **PENDING_ENVIRONMENT**
- RC / Stable promotion: **NOT AUTHORIZED**

## Identity
- Product: `4.3.0-dev.1`
- Release target: `4.3.0`
- Schema: `13`
- Android package: `com.salarymate.personal`
- Android versionCode: `14`
- iOS MARKETING_VERSION: `4.3.0`
- iOS build: `2`
- Version Drift: `0`

## Canonical source chain
- Initial baseline: `a2ffbb29e1e7b52ab6ca9dc9b30a975bcd384ec894b632b69177559ef36d08c4`
- CM-01 R1: `e27adfb5dfbbd0224bbcc6d763211a60991e8d474c5650f77a5ae27d3472ccd9`
- CM-02 R1: `af1f7deec719283f75b8519dd4100a283ef10f9902807caebfef7c78cbdfbb9e`
- CM-03 R1: `4b5d0c78b85b4d8d54ba17769d9ab778727d4da600d3ae24f30708cf4604b4c4`
- CM-04 R1: `2a06eabb854b722f1f13b19f7e3a5e0b9a7be5f62bf2f52bfd3a8f906906746a`
- CM-05 R1: `8c6223328d96b7e180ff40f012db7330618658149268cde1259dbed863ae88d8`
- **CM-06 Freeze R1: `3020cf41e964e282ebb607366d224a65fc8106490109c22ebb88fbf2cc935605`**

## CM results
- CM-01: PASS_TARGETED
- CM-02: IMPLEMENTATION_REGRESSION_PASS
- CM-03: IMPLEMENTATION_REGRESSION_PASS
- CM-04: IMPLEMENTATION_REGRESSION_PASS
- CM-05: IMPLEMENTATION_REGRESSION_PASS
- CM-06: PASS

## Final regression
- Node / source gates: **21 / 21 PASS**
- Kotlin native gate: **16 / 16 PASS**
- Product FAIL: **0**

## CM06-FIX-01
Android `NativeSnapshot.currentCompany` still had a legacy first-company fallback. CM-06 removed it. Invalid/absent Current Company identity now fails closed instead of silently selecting another company.

## Core isolation vs CM-04
- NativePayrollMath: SAME
- Storage: SAME
- Snapshot Store: SAME
- Backup Crypto: SAME
- Native Backup: SAME

## Historical OT
- Legacy validated: 914
- 2025/2026 validated: 459
- Combined retained contract: 1,373
- Physical live-device count: PENDING_DEVICE_GATE

## Environment pending
- Production build / dependency install
- Android SDK / Gradle / physical device
- iOS Xcode project parser / native build

No new CM feature work is permitted on this frozen source. PAX / RI / RC / Stable remain pending.
