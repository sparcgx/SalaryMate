# SalaryMate v5.0.0-dev.2-R42

2026-10-05. Existing Sites project `appgprj_6aa0d52f0f308191b5f325b9a8e004e4`.

- Company basic editing now groups base monthly pay, meal allowance, position allowance, night shift allowance and named custom fixed earnings under Pay calculation. Hourly companies edit hourly pay and regular hours in the same area.
- Live fixed-pay total, divisor and company default overtime hourly rate. The monthly default is total fixed pay / 240. Hourly companies use the existing converted monthly base and fixed allowances / regular hours convention. The separate overtime calculator retains its editable divisor.
- The editor reads the currently effective salary profile, including dated raises. Changes create/update today's salary adjustment; no-change/name-only edits do not create a raise. Initial company salary values, earlier adjustment profiles, future scheduled raises, saved payroll records and saved overtime rates are retained.
- Night shift allowance reuses `fixedEarnings` with `affectsHourly: true`. Existing IDs and ordering are retained. Only the first exact night-allowance name is presented as the dedicated field; any additional same-name rows remain visible custom items, avoiding dropped or double-counted amounts.
- New payroll defaults and existing leave deduction calculations include the same fixed earnings. New overtime now takes its rate from the company profile on the selected work date. New unsaved overtime follows date changes until the rate is entered manually. Saved entries retain their rates; an explicit Use company pay basis button is available.
- Salary rules also points to the unified editor. Input labels, descriptions and actions have Traditional Chinese / English translations. Mobile fields stack; custom names and amounts have separate labels and spacing. Existing style variables and reduced-motion behavior are preserved.
- No schema migration: Schema 15 and `salarymate_v5_full_state`. Existing backups, Google Drive, FIFO, quotes, NAV and style variants are unchanged. The dev service worker cache version now matches R42.

## Validation

`node --test tests/v5-r42-company-pay.test.mjs tests/v5-r38-rounding.test.mjs`: 14 / 14 passed. Production functions are executed directly in Node VM; no virtual browser is used.

Coverage: effective-profile loading, all five pay categories, custom and night-item identities, duplicate names, date-based snapshots, historical/future record preservation, same-day upsert, no-op/name-only edits, new company values, JSON normalization, hourly mode, date/manual/saved overtime handling, custom name and nonnegative amount validation, escaping, English labels, and September 76-hour rounding regression (19,665).

Calculation reference checked on 2026-10-05: [Ministry of Labor monthly calculator](https://calcr2.mol.gov.tw/Monthly), which states the 30 × 8 basis when monthly wages cover 240 hours. Existing company-agreed overtime multipliers are unchanged.

Mobile physical-device visual acceptance has not been claimed. Frozen v4.3.2 static files must remain unchanged.
