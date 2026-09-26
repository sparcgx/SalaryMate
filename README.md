# SalaryMate

個人薪資與收入管理工具。

## Current Development Line

**v4.3.0-dev.2｜PAX-04 Loading / Empty / Failure State Hardening**

Canonical Source SHA-256:

`58c2bf04d745ee26e825ef1e36c0452c9a9957a2fe50b36dac07e0072650a212`

- Baseline: `freeze/v4.3.0-dev.1`
- Schema: `13`
- Android versionCode: `15`
- iOS build: `3`
- PAX-01: **IMPLEMENTATION_REGRESSION_PASS**
- PAX-02: **IMPLEMENTATION_REGRESSION_PASS**
- PAX-03: **IMPLEMENTATION_REGRESSION_PASS**
- PAX-04 executable regression: **25 / 25 PASS**
- Product FAIL: **0**
- Physical state/lifecycle QA: **PENDING_DEVICE_QA**
- Full platform build/device gate: **PENDING_ENVIRONMENT**
- RC / Stable: **NOT AUTHORIZED**

PAX-04 separates Loading / Empty / Invalid / Failure / Ready / Submitting states and hardens startup, company-switch, retry, write rollback and restore failure behavior. Payroll math, repository model, storage, snapshot and backup cores remain frozen.

Next: **PAX-05｜Navigation / Draft / Context Operational Safety**

## Previous frozen baselines
- `freeze/v4.3.0-dev.1` — v4.3.0-dev.1 Development Source Freeze
- `stable/v4.2.0-web` — previous Web Stable Freeze
