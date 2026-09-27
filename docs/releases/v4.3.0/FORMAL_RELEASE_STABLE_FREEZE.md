# SalaryMate v4.3.0｜Formal Release & Stable Source Freeze

Date: 2026-09-27
Status: **SOURCE PASS / FORMAL BINARY PENDING**
Promotion source: **v4.3.0-RC.2**

## Formal identity
- Product version: 4.3.0
- Android package: com.salarymate.personal
- Android versionCode: 19
- Android versionName: 4.3.0
- iOS MARKETING_VERSION: 4.3.0
- iOS build: 7
- Schema: 13

## Inherited physical QA
Android PDQ-01~09 and iOS PDQ-01~10: PASS.

## Source freeze
- Formal source ZIP SHA-256: d5b7fc24df390477af5f4a2b5d16003fa90e6a982375078ca6a56406a30d6418
- Formal Stable Kit SHA-256: 6f036f019c6d2d804df3fcd5be96a55f19610514d8a69b507b6309e62fb7cbbe
- Version Drift: 0
- Core Hash Isolation: PASS
- Schema: 13 unchanged
- NativePayrollMath / NativeSalaryMateRepository / storage / backup crypto: unchanged from RC.2

## Binary rule
RC.2 APK/AAB are evidence artifacts only. They must not be renamed or published as v4.3.0. A fresh signed v4.3.0 Release build using the existing production keystore/signing identity is required before GitHub stable/v4.3.0 promotion.
