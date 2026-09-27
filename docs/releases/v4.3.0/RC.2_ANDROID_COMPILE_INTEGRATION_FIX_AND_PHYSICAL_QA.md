# SalaryMate v4.3.0-RC.2｜Android Compile Integration Fix & Physical QA Closure

Date: 2026-09-27
Status: **PASS / RC.2 FREEZE**

## Identity
- Product: 4.3.0-RC.2
- Android package: com.salarymate.personal
- Android versionCode: 19
- iOS build: 7
- Schema: 13

## RC.1 compile defects fixed
- NativeErrorCard onOpenHealth is passed by name in Payroll and Quick Entry.
- PayrollIdentityBox visibility is module-internal for shared Compose use.
- SalaryMateShell imports NativeSnapshot.

## Build evidence
- Windows Android production build: PASS
- testDebugUnitTest: PASS
- assembleDebugAndroidTest: PASS
- Signed APK SHA-256: 732c41190cba640478de3995351e591cce99e0ccf7bfb8bae0dc396856a91dc6
- Signed AAB SHA-256: 05484379c6650bd14b84824f38d19a639bc458b95ad74c487380b6d373e2c0d6

## Physical QA
- Android PDQ-01~09: PASS
- iOS PDQ-01~10: PASS
- In-place data preservation: PASS
- .salarymate backup/restore round-trip: PASS
- Lifecycle / long session: PASS
- Accessibility: PASS
- Cross-company isolation/write safety: PASS
- Golden numeric/historical data: PASS

## Zero tolerance
Wrong-company Write = 0; Context Leakage = 0; Stale Company Exposure = 0; Duplicate Commit = 0; Data Loss = 0.

RC.2 is frozen. Functional changes must not be added to this branch.
