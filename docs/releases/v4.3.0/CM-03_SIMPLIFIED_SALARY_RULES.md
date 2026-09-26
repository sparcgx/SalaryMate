# CM-03｜Simplified Salary Rules

Status: **IMPLEMENTATION REGRESSION PASS / FULL PLATFORM GATE PENDING**

## Final information architecture

1. 基本薪資
2. 固定收入
3. 加班規則
4. 獎金
5. 加項／扣項
6. 稅務

## Implementation contract

- Basic Salary is the current effective salary profile.
- Basic Salary and Fixed Income updates reuse existing `salaryAdjustments` effective snapshots.
- No SalaryRules v2 store / table / schema is introduced.
- Fixed income remains `mealAllowance + positionAllowance + fixedEarnings`.
- General bonus remains a monthly payroll transaction.
- One-time additions / deductions remain monthly payroll transactions.
- Year-End remains separate and belongs to Advanced Rules.
- Company default deductions reuse existing `laborIns` / `healthIns`.
- Tax page only describes the existing core boundary; no second tax formula is created.

## Core preservation

- `NativeSalaryMateRepository.kt`: SAME
- `NativePayrollMath.kt`: SAME
- `src/storage.js`: SAME
- `src/snapshot-store.mjs`: SAME
- `src/backup-crypto.mjs`: SAME
- `src/native-backup.mjs`: SAME
- Schema: `13`
- Version Drift: `0`

## Critical regression

Tax:
- 86,000 → 0
- 86,001 → 0
- 86,002 → 4,300 (5%)

OT core remains:
- 1
- 1.34
- 1.67
- 2
- 2.67
- Lunar New Year 2.5

## Regression

- Executable script commands: **18**
- PASS lines: **20**
- Product FAIL: **0**

Environment pending:
- Android compile / physical device: `PENDING_ENVIRONMENT`
- iOS Foundation parser: `PENDING_ENVIRONMENT` because the locked `xcode` npm module is unavailable in the current execution container.

Source package:
`SalaryMate_v4.3.0-dev.1_CM-03_Simplified_Salary_Rules_R1_Source.zip`

SHA-256:
`4b5d0c78b85b4d8d54ba17769d9ab778727d4da600d3ae24f30708cf4604b4c4`

Next: **CM-04｜Advanced Company Rules Simplification**
