# SalaryMate

個人薪資與收入管理工具。

## Current Development Line

**v4.3.0-dev.2｜PAX-03 Form Validation & Error Messaging**

Canonical Source SHA-256:

`3cbe056c70230a2fb627ef2afe51cd4e76c012caa3691dfb93e75a4bb77fc860`

- Baseline: `freeze/v4.3.0-dev.1`
- Schema: `13`
- Android versionCode: `15`
- iOS build: `3`
- PAX-01: **IMPLEMENTATION_REGRESSION_PASS**
- PAX-02: **IMPLEMENTATION_REGRESSION_PASS**
- PAX-03 executable regression: **24 / 24 PASS**
- Product FAIL: **0**
- Physical validation UX: **PENDING_DEVICE_QA**
- Full platform build/device gate: **PENDING_ENVIRONMENT**
- RC / Stable: **NOT AUTHORIZED**

PAX-03 adds field-level validation, Error/Warning/Info separation, first-error focus, fail-closed commit rollback and backup/restore error taxonomy. It does not change SalaryMate business formulas, Schema 13, repository data model or historical-data contracts.

Next: **PAX-04｜Loading / Empty / Failure State Hardening**

## Previous frozen baselines
- `freeze/v4.3.0-dev.1` — v4.3.0-dev.1 Development Source Freeze
- `stable/v4.2.0-web` — previous Web Stable Freeze
