# SalaryMate v5.0.0-dev.2-R45

2026-10-05. Existing Sites project `appgprj_6aa0d52f0f308191b5f325b9a8e004e4`.

- Salary rules → Earnings / deductions now opens a named, editable list of company fixed earnings and fixed deductions. Users can add/remove rows, set amounts, and see totals while editing. Existing labor/health insurance defaults remain in the same editor.
- Fixed earnings share the existing dated salary profile and company basic Pay calculation fields, including night shift allowance. Changes use today's effective date and preserve historical/future pay profiles and saved payroll amounts. Deductions reduce net pay and do not reduce the overtime hourly base.
- Optional company `fixedDeductions` defaults to an empty array for old data. New payroll records store copied rows in the existing `customDeductions` array with `sourceType: company-fixed-deduction` and the source item ID. Reapplying company defaults replaces only these rows, retaining manual and linked leave deductions.
- Copy previous month retains company fixed deduction rows with an accurate preview, while one-time and leave deductions continue to reset. Creating payroll from leave sync retains company defaults and applies the salary profile for the selected payroll month before adding leave charges.
- Existing company full-editor normalization, ordinary/encrypted backup payloads and payroll normalization retain the new optional fields. Schema 15 and `salarymate_v5_full_state` remain. No network transmission or Google Drive workflow changes.
- Traditional Chinese / English labels and existing responsive form styles. R44 compact NAV, investment calculations and frozen v4.3.2 remain untouched.

Validation: 21 tests passed with `node --test tests/v5-r42-company-pay.test.mjs tests/v5-r38-rounding.test.mjs`. Includes atomic custom-item validation, fixed earning/deduction totals, net pay, overtime base separation, old-data defaults, JSON normalization, historical payroll preservation, repeat-prefill deduplication, clearing templates, copy-month behavior, leave-sync payroll creation and earlier overtime/leave regression cases. JavaScript syntax and whitespace checks passed. Tests execute production functions in Node without a virtual browser; no mobile physical-device visual acceptance is claimed.
