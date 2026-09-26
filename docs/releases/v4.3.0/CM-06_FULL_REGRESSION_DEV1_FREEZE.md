# CM-06｜v4.3.0-dev.1 Full Regression & Development Freeze Gate

## Decision
- Development Source Freeze: **PASS**
- Full Platform Build / Device Gate: **PENDING_ENVIRONMENT**
- RC / Stable promotion: **NOT AUTHORIZED**

## Final regression
- Node / source gates: **21 / 21 PASS**
- Kotlin native gate: **16 / 16 PASS**
- Product FAIL: **0**
- Version Drift: **0**
- Schema: **13**

## CM06-FIX-01
CM-06 found and fixed an Android context leak risk in `NativeSnapshot.currentCompany`.

Before:
`currentCompanyId -> isCurrent -> first company`

After:
`currentCompanyId -> isCurrent -> null`

This restores the CM-05 fail-closed Current Company contract.

## Critical protection
- Tax: 86,000 → 0; 86,001 → 0; 86,002 → 4,300
- OT: 1 / 1.34 / 1.67 / 2 / 2.67; Lunar New Year 2.5
- Year-End runtime golden: $153,900
- Snapshot retention: 3
- Backup / restore regression: PASS
- Operational module company selectors: 0
- Silent first-company fallback: 0

## Core isolation vs CM-04 R1
- NativePayrollMath: SAME
- Storage: SAME
- Snapshot Store: SAME
- Backup Crypto: SAME
- Native Backup: SAME

## Historical OT
Retained workstation evidence:
- legacy OT: 914
- 2025/2026 OT: 459
- combined contract: 1,373
- combined unique identities: 1,373

Physical live-device count remains a later upgrade/device acceptance item.

## Environment pending
- Production build / esbuild dependency installation
- Android SDK / Gradle / physical device
- iOS Xcode project parser / native build

Source artifact:
`SalaryMate_v4.3.0-dev.1_CM-06_Full_Regression_Development_Freeze_R1_Source.zip`

SHA-256:
`3020cf41e964e282ebb607366d224a65fc8106490109c22ebb88fbf2cc935605`
