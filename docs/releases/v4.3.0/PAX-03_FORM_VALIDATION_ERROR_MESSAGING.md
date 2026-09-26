# PAX-03｜Form Validation & Error Messaging

Status: **IMPLEMENTATION REGRESSION PASS / DEVICE QA PENDING**

## Validation contract

Input validation is separated into:

1. Native / format constraints
2. Existing domain/business validation
3. Persistence / commit validation

PAX-03 does not create a second tax, overtime, payroll, annual-raise or year-end rules engine.

## UX contract

- Error blocks commit and binds to the field.
- Warning is confirmable and does not masquerade as an error.
- Info is explanatory only.
- The first invalid field receives focus.
- Long-form/domain errors can show a form-level validation summary while field errors remain inline.
- Commit failures restore in-memory state and state that original data remains unchanged.

## Key flows

- Company: blank name/date/negative salary errors; duplicate name and zero salary warnings.
- Payroll: current-company validation, 3-step validation, duplicate scope = `companyId + payrollMonth`.
- OT: hourly-rate/range and duplicate validation.
- Leave: date/order/range/overlap validation; quota conflicts remain confirmable warnings.
- Payroll cycle: custom days must be 1–31; fail-closed behavior preserved.
- Annual raise: effective-date and dispatch salary validation.
- Year-End: existing model fields only; invalid rules are not auto-repaired.
- Backup restore: unreadable / unsupported / corrupt / restore-failure messages are distinct.

## Regression

- Executable source gates: **24 / 24 PASS**
- Product FAIL: **0**
- Schema: **13**
- Version Drift: **0**

Core byte-identical to PAX-02 R1:
- NativePayrollMath
- NativeSalaryMateRepository
- Storage
- Snapshot Store
- Backup Crypto
- Native Backup

Physical Android/iOS validation UX and native build gates remain pending for later platform/device validation.

Source SHA-256: `3cbe056c70230a2fb627ef2afe51cd4e76c012caa3691dfb93e75a4bb77fc860`

Next: **PAX-04｜Loading / Empty / Failure State Hardening**
