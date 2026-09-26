# SalaryMate

個人薪資與收入管理工具。

## Current Development Line

**v4.3.0-dev.2｜PAX-05 Navigation / Draft / Context Operational Safety**

Canonical Source SHA-256:

`f99bf4c93f301c9f603163152c9291f0fc1ef409aa91b575b133bb31d9ff9940`

- Baseline: `freeze/v4.3.0-dev.1`
- Schema: `13`
- Android versionCode: `15`
- iOS build: `3`
- PAX-01: **IMPLEMENTATION_REGRESSION_PASS**
- PAX-02: **IMPLEMENTATION_REGRESSION_PASS**
- PAX-03: **IMPLEMENTATION_REGRESSION_PASS**
- PAX-04: **IMPLEMENTATION_REGRESSION_PASS**
- PAX-05 executable regression: **26 / 26 PASS**
- Product FAIL: **0**
- Wrong-company write observed automated: **0**
- Duplicate UI write observed automated: **0**
- Physical operational-safety QA: **PENDING_DEVICE_QA**
- Full platform build/device gate: **PENDING_ENVIRONMENT**
- RC / Stable: **NOT AUTHORIZED**

PAX-05 hardens Draft Scope, Dirty Guard, logical Back, selected-entity scope, stale async rejection, double-submit protection and restore context re-resolution. Payroll math, repository model, storage, snapshot and backup formats remain frozen.

Next: **PAX-06｜Full Regression & dev.2 Freeze Gate**

## Previous frozen baselines
- `freeze/v4.3.0-dev.1` — v4.3.0-dev.1 Development Source Freeze
- `stable/v4.2.0-web` — previous Web Stable Freeze
