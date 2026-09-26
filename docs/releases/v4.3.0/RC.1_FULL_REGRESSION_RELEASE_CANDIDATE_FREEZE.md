# v4.3.0-RC.1｜Full Regression & Release Candidate Freeze Gate

Status: **RC SOURCE FREEZE PASS / PLATFORM & DEVICE PENDING**

## Identity
- Product: `4.3.0-RC.1`
- Android versionCode: `18`
- iOS build: `6`
- Schema: `13`
- Version Drift: `0`

## Regression
- Full source regression: **47 PASS / 0 FAIL**
- RC-01～RC-06: **PASS**
- Manifest: **324 files / 0 SHA errors**
- ZIP integrity: **PASS**

## Core isolation vs dev.4
NativePayrollMath, NativeSalaryMateRepository, Storage, Snapshot Store and Backup Crypto are byte-identical. Native Backup differs only in the product-version binding.

## Pending
Production build, Android SDK/device, iOS Foundation/native build, in-place upgrade/data preservation, physical backup/restore, lifecycle/long-session and manual accessibility acceptance remain pending.

Stable promotion is **NOT AUTHORIZED**.

Canonical Source SHA-256:

`bfef4c6de7901d55933fc9730b00f4ad7355aa6ea075ec41a0547998cfde1c97`
