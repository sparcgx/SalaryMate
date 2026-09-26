# CM-04｜Advanced Company Rules Simplification

Status: **IMPLEMENTATION REGRESSION PASS / FULL PLATFORM GATE PENDING**

## Information architecture

1. 特殊薪資週期
2. 年度加薪
3. 年終規則
4. 其他特殊規則

## Data contract

- Schema remains `13`.
- No second Company Store.
- No AdvancedRules / SpecialRules table.
- No arbitrary formula editor or Rule Engine.
- Annual Raise reuses existing `salaryAdjustments` with `reason = annual`.
- Year-End reuses existing `yearEndEstimates` and existing Year-End calculation.
- Other Special Rules only summarizes already-supported company fields.

## Payroll cycles

Existing behavior remains compatible:
- Standard: `1 → month end`
- Legacy: `16 → next month 15`

CM-04 adds optional fields inside the existing Company JSON:
- `payrollCycleStartDay`
- `payrollCycleEndDay`

Supported examples:
- `5 → 25`
- `16 → 15`
- `20 → 19`

For bounded same-month cycles such as `5 → 25`, dates outside the configured range remain unattributed. No silent fallback to calendar month is allowed.

## Regression

- Script gates: **19 PASS / 0 FAIL**
- PASS messages: **21**
- Native Kotlin payroll-cycle execution: **16 PASS / 0 FAIL**
- Schema: `13`
- Version Drift: `0`

Unchanged:
- `src/storage.js`
- `src/snapshot-store.mjs`
- `src/backup-crypto.mjs`
- `src/native-backup.mjs`

Intentional extension:
- `NativePayrollMath.kt`: payroll-period resolver only; existing calendar / prev16 behavior preserved.
- `NativeSalaryMateRepository.kt`: optional custom-cycle field parsing only.

Environment pending:
- Android full Gradle/device gate: `PENDING_ENVIRONMENT`
- iOS Foundation parser: `PENDING_ENVIRONMENT`

Source SHA-256: `2a06eabb854b722f1f13b19f7e3a5e0b9a7be5f62bf2f52bfd3a8f906906746a`

Next: **CM-05｜Company Workflow Simplification & Cross-Platform UX**
