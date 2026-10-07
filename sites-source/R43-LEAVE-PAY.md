# SalaryMate v5.0.0-dev.2-R43

- Confirmed existing sick and menstrual leave defaults: paid ratio 50%, wage deduction 50%.
- Confirmed personal and family care leave defaults: paid ratio 0%, wage deduction 100%.
- Leave options now label these defaults as half-pay/full-pay deductions. Actual deduction percentage, wage deduction and total deduction are visible before opening additional settings. Changing a leave type applies its default paid ratio through the existing handler; manual paid-ratio changes update the visible preview.
- Existing saved leave records retain their own paid ratios. No data migration, payroll rewrite or change to fixed-wage bases. Schema 15, storage key, backup and Google Drive paths retained. Frozen v4.3.2 unchanged.

Validation: 15 tests passed via `node --test tests/v5-r42-company-pay.test.mjs tests/v5-r38-rounding.test.mjs`, including half/full-day calculations for all four leave types and September overtime rounding. JavaScript syntax checked. No virtual browser used; no physical mobile visual acceptance claimed.
