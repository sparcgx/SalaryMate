# SalaryMate v4.3.0-RC.1｜iOS Physical Acceptance

Status: **PENDING_DEVICE_QA**

## Identity
- Product: `4.3.0-RC.1`
- iOS build: `6`
- Schema: `13`
- Target: signed/native build on physical iPhone

## I-01 Production/native build
- [ ] Xcode production/native build succeeds
- [ ] Signing identity / Team is valid
- [ ] Build number = 6
- [ ] App identity matches upgrade target
- [ ] Native modules resolve without placeholder/fallback behavior

## I-02 Real-device launch
- [ ] Physical iPhone install succeeds
- [ ] App launches without crash
- [ ] Current Company resolves correctly
- [ ] Missing/invalid Current Company fails closed
- [ ] Foreground security / privacy behavior is correct

## I-03 In-place upgrade / data preservation
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
- [ ] No valid record loss
- [ ] No duplicate records introduced
- [ ] Wrong-company Write = 0
- [ ] Duplicate Commit = 0

## I-04 Backup / restore physical round-trip
- [ ] Export .salarymate backup from State A
- [ ] Modify to State B
- [ ] Restore backup
- [ ] State returns to A
- [ ] Corrupt / unsupported backup is rejected without data mutation
- [ ] .salarymate compatibility preserved
- [ ] Snapshot retention = 3

## I-05 Lifecycle / long session
- [ ] Background → foreground preserves Draft / Context
- [ ] Screen lock / unlock behavior correct
- [ ] Force-close → relaunch preserves persisted data
- [ ] Unsaved Draft is never auto-committed
- [ ] Long session does not duplicate commits
- [ ] Company switch remains correct after lifecycle events

## I-06 VoiceOver / Dynamic Type / keyboard
- [ ] VoiceOver can reach primary navigation
- [ ] Current Company selector has understandable label/state
- [ ] Quick Entry fields and validation are announced
- [ ] Payroll 3-step workflow is operable
- [ ] Company Management is operable
- [ ] Backup / restore controls are understandable
- [ ] Dynamic Type does not hide critical actions
- [ ] External/software keyboard flow remains operable where applicable

## I-07 Golden physical checks
- [ ] Tax 86,000 → 0
- [ ] Tax 86,001 → 0
- [ ] Tax 86,002 → 4,300
- [ ] OT 1 / 1.34 / 1.67 / 2 / 2.67
- [ ] Lunar New Year OT = 2.5
- [ ] Year-End Runtime Golden = 153,900
- [ ] Historical OT contract = 1,373
- [ ] Snapshot retention = 3

## Result
iOS Physical Acceptance: **PENDING**
