# v4.3.0-RC.1｜Release Candidate Freeze Status

## Decision
- RC Source Freeze: **PASS**
- Full Source Regression: **47 PASS / 0 FAIL**
- Source Manifest: **324 files / 0 SHA errors**
- ZIP Integrity: **PASS**
- Full Platform Build / Device: **PENDING_ENVIRONMENT**
- Physical Device QA: **PENDING_DEVICE_QA**
- Stable Promotion: **NOT AUTHORIZED**

## Identity
- Product: `4.3.0-RC.1`
- Release target: `4.3.0`
- Schema: `13`
- Android versionCode: `18`
- iOS build: `6`
- Version Drift: `0`

## Critical invariants
- Tax: 86,000 → 0; 86,001 → 0; 86,002 → 4,300
- OT: 1 / 1.34 / 1.67 / 2 / 2.67; Lunar New Year 2.5
- Year-End Runtime Golden: 153,900
- Historical OT retained contract: 1,373 / 1,373 unique identities
- Snapshot retention: 3
- Wrong-company write observed automated: 0
- Duplicate UI write observed automated: 0
- Silent first-company fallback: 0

## Core isolation vs dev.4
- NativePayrollMath: SAME
- NativeSalaryMateRepository: SAME
- Storage: SAME
- Snapshot Store: SAME
- Backup Crypto: SAME
- Native Backup: VERSION_BINDING_ONLY

## Environment / physical status
- Production build: **PENDING_ENVIRONMENT** — esbuild unavailable
- Android SDK / ADB / device: **PENDING_ENVIRONMENT**
- iOS Foundation/native build: **PENDING_ENVIRONMENT** — xcode npm module unavailable
- Real device / upgrade / backup / lifecycle / manual acceptance: **NOT_RUN**

## Canonical source
`bfef4c6de7901d55933fc9730b00f4ad7355aa6ea075ec41a0547998cfde1c97`

`SalaryMate_v4.3.0-RC.1_Full_Regression_Release_Candidate_Freeze_R1_Source.zip`

Stable remains blocked until required physical evidence is PASS.
