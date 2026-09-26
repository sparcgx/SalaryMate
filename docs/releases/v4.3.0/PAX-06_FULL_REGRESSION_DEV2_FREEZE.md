# PAX-06｜Full Regression & dev.2 Freeze Gate

Status: **DEVELOPMENT SOURCE FREEZE PASS / FULL PLATFORM GATE PENDING**

## Final result
- PAX-01～PAX-05: PASS / PRESERVED
- PAX-06 full source regression: **27 / 27 PASS**
- Product FAIL: **0**
- Schema: **13**
- Version Drift: **0**
- Source Manifest: **274 files / 0 SHA errors**
- ZIP integrity: **PASS**
- Development Source Freeze: **PASS**
- Full Platform Build / Device: **PENDING_ENVIRONMENT**
- Physical Device QA: **PENDING_DEVICE_QA**
- RC / Stable promotion: **NOT AUTHORIZED**

## Critical invariants
- Tax: 86,000 → 0; 86,001 → 0; 86,002 → 4,300.
- OT: 1 / 1.34 / 1.67 / 2 / 2.67; Lunar New Year 2.5.
- Year-End Runtime Golden: 153,900.
- Historical OT retained contract: 914 + 459 = 1,373; 1,373 unique.
- Snapshot retention: 3.
- Wrong-company write observed automated: 0.
- Duplicate UI write observed automated: 0.
- Silent first-company fallback: 0.

## Core isolation vs PAX-05 R1
- NativePayrollMath: SAME
- NativeSalaryMateRepository: SAME
- Storage: SAME
- Snapshot Store: SAME
- Backup Crypto: SAME
- Native Backup: SAME

## Environment pending
- Production build: esbuild unavailable.
- Android SDK / ADB / Gradle / physical device unavailable.
- iOS Foundation/native build: xcode npm module unavailable; ios-gate-test PASS.

Canonical freeze source:

`SalaryMate_v4.3.0-dev.2_PAX-06_Full_Regression_dev2_Freeze_R1_Source.zip`

SHA-256:

`886b230c38b0a4af5d6662c259fc96b6cb341f83d42328c9bdd60910ad89b7a6`

Next lifecycle line: **v4.3.0-dev.3｜Release Integration & Real-Device Hardening**
