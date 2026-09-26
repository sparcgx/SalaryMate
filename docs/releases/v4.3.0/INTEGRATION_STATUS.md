# v4.3.0-dev.2｜Development Source Freeze

## Decision
- PAX-01～PAX-05: **PASS / PRESERVED**
- PAX-06 Full Regression: **PASS**
- Development Source Freeze: **PASS**
- Full Platform Build / Device Gate: **PENDING_ENVIRONMENT**
- Physical Device QA: **PENDING_DEVICE_QA**
- RC / Stable Promotion: **NOT AUTHORIZED**

## Identity
- Product: `4.3.0-dev.2`
- Release target: `4.3.0`
- Schema: `13`
- Android versionCode: `15`
- iOS build: `3`
- Version Drift: `0`

## Final regression
- Executable source gates: **27 / 27 PASS**
- Product FAIL: **0**
- Source Manifest: **274 files / 0 SHA errors**
- ZIP integrity: **PASS**
- Wrong-company write observed automated: **0**
- Duplicate UI write observed automated: **0**

## Critical invariants
- Tax boundary: 86,000 → 0; 86,001 → 0; 86,002 → 4,300
- OT: 1 / 1.34 / 1.67 / 2 / 2.67; Lunar New Year 2.5
- Year-End Runtime Golden: 153,900
- Historical OT retained contract: 1,373; unique identities: 1,373
- Snapshot retention: 3
- Silent Current Company fallback: 0

## Core isolation vs PAX-05 R1
- NativePayrollMath: SAME
- NativeSalaryMateRepository: SAME
- Storage: SAME
- Snapshot Store: SAME
- Backup Crypto: SAME
- Native Backup: SAME

## Platform status
- ios-gate-test: PASS
- Production Build: PENDING_ENVIRONMENT
- Android SDK / Gradle / Device: PENDING_ENVIRONMENT
- iOS Foundation / Native Build: PENDING_ENVIRONMENT
- Physical Accessibility / State / Operational QA: PENDING_DEVICE_QA

## Canonical freeze artifact
`886b230c38b0a4af5d6662c259fc96b6cb341f83d42328c9bdd60910ad89b7a6`

`SalaryMate_v4.3.0-dev.2_PAX-06_Full_Regression_dev2_Freeze_R1_Source.zip`

No new feature work is permitted on this frozen snapshot.

## Next lifecycle line
**v4.3.0-dev.3｜Release Integration & Real-Device Hardening**
