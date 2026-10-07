# SalaryMate v5.0.0-dev.1 — 工作日曆重製

## Status

Independent web development build requested as a from-zero interface and workflow redesign. NOT an Android release, Stable promotion, compliance clearance, or v4 replacement. v4.3.2 remains the stable baseline; v4.3.3-dev.1 compliance work remains pending and iOS remains PAUSED.

## Product scope

- White background, text navigation, quiet rules, compact monthly overview; no glass effects, decorative icons, promotional hero or AI features.
- Calendar-first desktop and phone layouts, date selection and keyboard navigation.
- Overtime and leave create/edit/cancel; confirmed/planned/cancelled status; filtered monthly records.
- Per-company annual leave quotas in hours, calendar-year accounting, separate used/booked/available balances; cancellation refunds allocation.
- Future confirmed leave and any planned leave reserve annual allowance. Nonannual leave does not deduct annual leave or payroll.
- Optional hourly rate and per-entry multiplier snapshots. Overtime is a user-entered approximation, not a legal day-type rules engine. No weekday inference, payroll tax rules or legal entitlement estimates are introduced.
- Company isolation, JSON backup/validated restore with pre-restore download, local storage error and concurrent-tab write guards.
- New PWA scope and cache prefix, with offline shell; old application storage and caches are not deleted.

## Isolation

- All product files: `dist/dev/v5.0.0-dev.1/`.
- New local key: `salarymate_v5_worklog`, schema `1` (independent web worklog, NOT an upgrade of native Schema 13).
- No v4 keys are read, migrated, or written. No v4 backup import in this build.
- No native package identity, versionCode, signer, or Android source has changed.
- Existing tracked site files remain byte-for-byte unchanged; new tests and this document are additive.

## Verification

Run `node --test --test-isolation=none tests/v5-worklog.test.mjs tests/v5-dom.test.mjs`.
The DOM test uses jsdom; set `SALARYMATE_DOM_MODULE` to the absolute module path when needed. Test dependency is external to the project and does not alter its package manifest or lockfile.

16 tests pass: calendar/leap dates, leave accounting, company/year isolation, edits/cancellation, quota guard, unknown vs zero quota, monthly overtime summaries, historical rate snapshots, invalid inputs/daily cap, backup structure/round trip, storage failures/v4 isolation, concurrent writes/corruption, full DOM flows, form error retention, restore preview/confirmation, date keyboard controls and labels.

Native dialog display, actual download behavior, offline lifecycle, visual layout, phone interaction, Android build/signing/install, and device-level data retention require real-browser/device acceptance. DOM tests use dialog and download shims and do not establish those results. No browser visual QA was performed in this environment.

## Manual acceptance

1. Open the v5 development path on a phone; switch month and select a date.
2. Record overtime with hours and optional rate; reload and verify the record persists.
3. Set company-approved annual leave hours; add confirmed and future planned leave.
4. Edit/cancel a leave record and verify used/booked/available amounts.
5. Add a second company and confirm records and quotas remain separate.
6. Export JSON, restore it after reviewing the counts, and verify records.
7. After an online visit and service worker activation, test reload with networking disabled.
8. Confirm the original v4 page and its local data remain usable.

## Deliberately pending

Native Android implementation and signing, existing-data migration, full monthly payroll/deductions, anniversary leave cycles/carryover/expiry and statutory calculations. These are not claimed as implemented by this worklog redesign.
