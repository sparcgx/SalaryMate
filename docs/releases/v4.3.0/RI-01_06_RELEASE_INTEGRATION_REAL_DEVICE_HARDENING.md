# v4.3.0-dev.3｜Release Integration & Real-Device Hardening

Status: **SOURCE INTEGRATION REGRESSION PASS / REAL DEVICE PENDING**

## Identity
- Product: `4.3.0-dev.3`
- Android versionCode: `16`
- iOS build: `4`
- Schema: `13`
- Version Drift: `0`

## RI source gates
- RI-01 Release Identity: PASS
- RI-02 Upgrade / Data Preservation Contract: PASS
- RI-03 Real-device Evidence Contract: PASS
- RI-04 Backup Physical Round-trip Contract: PASS
- RI-05 Lifecycle / Recovery Contract: PASS
- RI-06 Source Integration Regression: PASS

Source regression: **35 PASS lines / 0 product FAIL**.

## Environment
Observed execution environment:
- JDK 21: PASS
- Production build: PENDING_ENVIRONMENT — esbuild unavailable
- Android SDK / ADB / physical device: PENDING_ENVIRONMENT
- iOS Xcode / xcode npm module: PENDING_ENVIRONMENT
- ios-gate-test: PASS

## Physical acceptance
The following remain NOT_RUN / PENDING_DEVICE_QA:
- real device
- upgrade / data preservation
- backup / restore physical round-trip
- lifecycle / long-session
- physical wrong-company write / duplicate commit checks

## Core isolation vs dev.2 Freeze
- NativePayrollMath: SAME
- NativeSalaryMateRepository: SAME
- Storage: SAME
- Snapshot Store: SAME
- Backup Crypto: SAME
- Native Backup: VERSION_BINDING_ONLY

Canonical Source SHA-256:

`ef3bb060e345e7ebdd779dcc1cbc35ba4a4c454b5800e59078b1f0023405f956`

RC / Stable promotion remains unauthorized.
