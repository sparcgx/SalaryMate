# SalaryMate v4.3.0-RC.1｜Android Physical Acceptance

Status: **PENDING_DEVICE_QA**

## Identity
- Package: `com.salarymate.personal`
- versionCode: `18`
- Schema: `13`
- Expected upgrade method: data-preserving install; do not uninstall and do not clear App data.

## A-01 Production build
- [ ] Signed release/production APK builds successfully
- [ ] Package = `com.salarymate.personal`
- [ ] versionCode = 18
- [ ] Existing app identity matches upgrade target
- [ ] No debug-only identity / storage path

## A-02 Real-device install / launch
- [ ] Physical Android device recognized
- [ ] Data-preserving install succeeds
- [ ] App launches without crash
- [ ] Current Company resolves correctly
- [ ] Missing/invalid Current Company fails closed

## A-03 In-place upgrade / data preservation
Before upgrade record:
- [ ] Company count
- [ ] OT count
- [ ] Attendance count
- [ ] Addition count
- [ ] Payslip count
- [ ] Snapshot count
- [ ] Current Company ID
- [ ] Historical OT = 1,373 where applicable

After upgrade:
- [ ] All counts match expected values
- [ ] Current Company preserved
- [ ] Cross-company records remain isolated
- [ ] No orphaned valid records
- [ ] No duplicate records introduced
- [ ] Wrong-company Write = 0
- [ ] Duplicate Commit = 0

## A-04 Backup / restore physical round-trip
- [ ] Export .salarymate backup from State A
- [ ] Modify to State B
- [ ] Restore backup
- [ ] State returns to A
- [ ] Existing data remains intact after rejected corrupt backup
- [ ] .salarymate compatibility preserved
- [ ] Snapshot retention = 3

## A-05 Lifecycle / long session
- [ ] Background → foreground preserves Draft / Context
- [ ] Screen lock / unlock preserves persisted state
- [ ] Force-close → relaunch preserves persisted data
- [ ] Unsaved Draft is never auto-committed
- [ ] Long session does not duplicate commits
- [ ] Company switch remains correct after lifecycle events

## A-06 TalkBack / touch
- [ ] TalkBack can reach primary navigation
- [ ] Current Company selector has understandable label/state
- [ ] Quick Entry fields and validation are announced
- [ ] Payroll 3-step workflow is operable
- [ ] Company Management is operable
- [ ] Backup / restore controls are understandable
- [ ] Touch targets are usable on phone layout

## A-07 Golden physical checks
- [ ] Tax 86,000 → 0
- [ ] Tax 86,001 → 0
- [ ] Tax 86,002 → 4,300
- [ ] OT 1 / 1.34 / 1.67 / 2 / 2.67
- [ ] Lunar New Year OT = 2.5
- [ ] Year-End Runtime Golden = 153,900
- [ ] Historical OT contract = 1,373
- [ ] Snapshot retention = 3

## Result
Android Physical Acceptance: **PENDING**
