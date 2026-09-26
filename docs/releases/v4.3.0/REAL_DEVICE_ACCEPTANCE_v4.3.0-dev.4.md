# SalaryMate v4.3.0-dev.4｜RC Readiness Real-Device Acceptance

## Current decision
- Physical execution: **NOT_RUN**
- RC promotion: **HOLD FOR RELEASE**

## Required Android evidence
- Real device: NOT_RUN
- Signed build identity: NOT_RUN
- In-place upgrade: NOT_RUN
- Upgrade / data preservation: NOT_RUN
- Historical OT physical count = 1,373: NOT_RUN
- Backup / restore physical round-trip: NOT_RUN
- Lifecycle / background / foreground: NOT_RUN
- Long session: NOT_RUN
- Wrong-company Write = 0: NOT_RUN
- Duplicate Commit = 0: NOT_RUN

## Required iOS evidence
- Real device: NOT_RUN
- Signed/native build identity: NOT_RUN
- Upgrade / data preservation: NOT_RUN
- Backup / restore physical round-trip: NOT_RUN
- VoiceOver / Dynamic Type / keyboard: NOT_RUN
- Lifecycle / background / foreground: NOT_RUN
- Long session: NOT_RUN
- Wrong-company Write = 0: NOT_RUN
- Duplicate Commit = 0: NOT_RUN

## Golden flow
Launch → Current Company A → Quick Entry → Payroll A → Create B → Switch B → Payroll B → Switch A → Verify isolation → Backup → Modify → Restore → Restart.

## Physical backup / lifecycle golden
- State A → Backup → State B → Restore → State A
- Background → Foreground preserves Draft / Context
- Force Close → Relaunch preserves persisted data and never auto-commits an unsaved Draft
- Corrupt / unsupported backup leaves existing data unchanged

RC may be considered only after all required build/device/upgrade/backup/lifecycle/manual evidence is PASS.
