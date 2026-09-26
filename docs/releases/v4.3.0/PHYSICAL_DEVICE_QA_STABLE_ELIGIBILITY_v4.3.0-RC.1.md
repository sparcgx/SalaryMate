# SalaryMate v4.3.0-RC.1｜Physical Device QA & Stable Eligibility Gate

Status: **ACTIVE / DEVICE QA PENDING / STABLE NOT AUTHORIZED**

## Locked baseline
- RC branch: `v4.3.0-RC.1`
- Freeze branch: `freeze/v4.3.0-RC.1`
- Baseline commit: `5842eaf0f36026aea81c283b18708a0a01bfea8d`
- Canonical Source SHA-256: `bfef4c6de7901d55933fc9730b00f4ad7355aa6ea075ec41a0547998cfde1c97`
- Android package: `com.salarymate.personal`
- Android versionCode: `18`
- iOS build: `6`
- Schema: `13`

## Immutable contracts
No test-stage change may alter:
- NativeSalaryMateRepository
- NativePayrollMath
- single Attendance / OT / Addition / Payslip / Company store architecture
- Current Company fail-closed behavior
- Cross-Company Isolation
- Snapshot / Lock
- Orphan Quarantine
- .salarymate backup compatibility
- Historical OT count contract = 1,373
- Snapshot retention = 3

## Stable Eligibility Gates
| Gate | Scope | Android | iOS | Overall |
|---|---|---|---|---|
| PDQ-01 | Production build + release identity | PENDING | PENDING | PENDING |
| PDQ-02 | Real-device launch / install | PENDING | PENDING | PENDING |
| PDQ-03 | In-place upgrade + data preservation | PENDING | PENDING | PENDING |
| PDQ-04 | Backup / restore physical round-trip | PENDING | PENDING | PENDING |
| PDQ-05 | Lifecycle / background / foreground / force-close / long session | PENDING | PENDING | PENDING |
| PDQ-06 | Accessibility manual acceptance | TalkBack PENDING | VoiceOver PENDING | PENDING |
| PDQ-07 | Cross-company / duplicate-write physical checks | PENDING | PENDING | PENDING |
| PDQ-08 | Golden payroll / OT / year-end / historical data checks | PENDING | PENDING | PENDING |
| PDQ-09 | Final manual acceptance + Stable eligibility | PENDING | PENDING | NOT AUTHORIZED |

## Golden flow
Launch → Current Company A → Quick Entry → Payroll A → Create B → Switch B → Payroll B → Switch A → Verify isolation → Backup → Modify → Restore → Restart.

## Physical backup / lifecycle golden
- State A → Backup → State B → Restore → State A
- Background → Foreground preserves Draft / Context
- Force Close → Relaunch preserves persisted data
- Force Close / relaunch never auto-commits an unsaved Draft
- Corrupt / unsupported backup leaves existing data unchanged
- Snapshot retention remains 3

## Golden numeric contracts
- Tax: 86,000 → 0
- Tax: 86,001 → 0
- Tax: 86,002 → 4,300
- OT multipliers: 1 / 1.34 / 1.67 / 2 / 2.67
- Lunar New Year OT multiplier: 2.5
- Year-End Runtime Golden: 153,900
- Historical OT contract: 1,373

## Stable promotion rule
`v4.3.0｜Stable Promotion & Formal Release Gate` remains blocked while any required item is PENDING, NOT_RUN, INCOMPLETE or FAIL.

No Stable tag/branch/version identity may be created by this QA branch.
