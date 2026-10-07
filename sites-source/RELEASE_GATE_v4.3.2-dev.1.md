# SalaryMate v4.3.2-dev.1

Web/PWA development release: monthly payslip reconciliation.

## Included
- Compare fixed and custom earnings/deductions, gross, total deductions and payroll net against company payslip amounts. Side income is excluded.
- Blank means missing; explicit zero is supported. Differences are company amount minus calculated amount.
- Save drafts and notes independently of salary amounts. Completion requires all amounts to match and no unresolved overtime/leave source warning.
- Salary or source changes require another review. Copied monthly records start without reconciliation.
- Reconciliation is stored with the existing record and included in existing JSON backup data. Older versions may discard these new fields; preserve a backup before rollback.

## Verification
22 automated tests passed, zero failed: existing glass/application tests and seven reconciliation tests. Source gates verify approved app changes, preserved base styles/bootstrap, and offline shell assets.
These are local automated checks, not Android/iOS device certification. New UI device acceptance remains pending.

## Manual acceptance
1. Open a salary record's 月結核對 action; opening must not change stored payroll data.
2. Leave one amount blank: completion must be blocked. Enter 0 explicitly for absent items.
3. Enter a differing company amount: show signed difference; draft may save, completion must be blocked.
4. Match every amount with source warnings resolved: confirm, reload, and verify 已核對.
5. Edit payroll, overtime or leave: verify 需重新核對. Duplicate the month: verify no copied reconciliation.
6. Export and restore JSON using this version; verify amounts, notes, status, company isolation and existing salary data.

## Release boundaries
- Stable/Freeze references and GitHub Pages stable release remain unchanged. GitHub development branch: dev/v4.3.2-dev.1.
- Native fault injection and Android/iOS gates: UNVERIFIED.
- Existing data-safety BLOCKER: OPEN; this release does not close it.
- Copy-month preview, additional backup UX, leave dashboard and later roadmap items are outside this release.
