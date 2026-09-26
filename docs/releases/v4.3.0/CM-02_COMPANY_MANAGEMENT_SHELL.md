# CM-02｜Company Management Shell

Status: **IMPLEMENTATION REGRESSION PASS / PLATFORM BUILD & DEVICE PENDING**

## Scope
- Single Company Management entry.
- Dashboard company selector is switch-only.
- Current company card + other companies list.
- Company detail and basic edit are separate states.
- Add company uses only: company name, base salary, employment start date.
- First company becomes current automatically.
- Adding a second company does not change current company.
- Duplicate company name is a warning, not a hard error.
- Base salary 0 is a warning, not a hard error.
- Existing full company settings remain as a compatibility entry for CM-03 / CM-04.

## Data contract
- Existing Schema 13 only.
- Existing company data in the canonical snapshot only.
- Android writes through `NativeSalaryMateRepository`.
- No second Company Store / table / database.
- Payroll math, storage, snapshot and backup formats are unchanged.

## Platform integration
- Web / Shared: Company Management is a main navigation destination; the top selector switches current company only.
- Android: `NativeCompanyManagementScreen` uses the existing repository for add/edit/switch operations.
- iOS: current Hybrid path consumes the shared Web Company Management shell.

## Regression
- Script gates: **17**
- PASS lines: **19**
- Product FAIL: **0**
- Version Drift: **0**

Core isolation:
- `NativePayrollMath.kt`: SAME
- `src/storage.js`: SAME
- `src/snapshot-store.mjs`: SAME
- `src/backup-crypto.mjs`: SAME
- `src/native-backup.mjs`: SAME

## Environment pending
- Android compile/device: PENDING_ENVIRONMENT — Android SDK unavailable in current execution container.
- iOS Foundation parser: PENDING_ENVIRONMENT — locked `xcode` npm module unavailable.

These are not product failures.

Source package SHA-256: `af1f7deec719283f75b8519dd4100a283ef10f9902807caebfef7c78cbdfbb9e`

Next: `CM-03｜Simplified Salary Rules`
