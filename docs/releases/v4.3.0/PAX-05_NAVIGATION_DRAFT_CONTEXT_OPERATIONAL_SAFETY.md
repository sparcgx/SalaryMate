# PAX-05｜Navigation / Draft / Context Operational Safety

Status: **IMPLEMENTATION REGRESSION PASS / PHYSICAL OPERATIONAL QA PENDING**

## Operational contract
- Draft scope and Dirty state are independent.
- Operational commit requires Draft company = Current Company = Commit target.
- Payroll draft additionally binds payroll month.
- Existing-entity drafts bind entity identity.
- Selected operational entities are invalidated on company switch.
- Company Management may explicitly view/edit a non-current target company without changing Current Company.
- Context generation rejects stale async results.
- Browser Back follows logical Company Management parent routes and cannot bypass Dirty Guard.
- Android bottom navigation/system Back respect dirty payroll/company drafts.
- Per-draft operation identity blocks duplicate submit without blocking unrelated new records.
- Restore confirm is operation-locked and restore success clears/re-resolves transient context.

## Automated regression
- Executable source gates: **26 / 26 PASS**
- Product FAIL: **0**
- Schema: **13**
- Version Drift: **0**
- Wrong-company write observed in automated regression: **0**
- Duplicate UI write observed in automated regression: **0**
- Physical rapid-switch/double-tap/lifecycle validation: **PENDING_DEVICE_QA**

## Core isolation vs PAX-04 R1
Byte-identical:
- NativePayrollMath
- NativeSalaryMateRepository
- Storage
- Snapshot Store
- Backup Crypto
- Native Backup

## Environment pending
- Production build / esbuild
- Android SDK / Gradle / physical device
- iOS xcode npm parser / native build

Canonical source SHA-256:
`f99bf4c93f301c9f603163152c9291f0fc1ef409aa91b575b133bb31d9ff9940`

Next: **PAX-06｜Full Regression & dev.2 Freeze Gate**
