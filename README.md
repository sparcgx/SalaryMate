# SalaryMate

個人薪資與收入管理工具。

## Current Development Line

**v4.3.0-dev.2｜PAX-02 Accessibility & Keyboard / Touch Hardening**

Canonical Source SHA-256:

`aa52632f13ce3678db7142c823ac16969298c1fb7b61b242cdff551f1a5ae5a7`

- Baseline: `freeze/v4.3.0-dev.1`
- Schema: `13`
- Android versionCode: `15`
- iOS build: `3`
- PAX-01: **IMPLEMENTATION_REGRESSION_PASS**
- PAX-02 executable regression: **23 / 23 PASS**
- Product FAIL: **0**
- Physical accessibility QA: **PENDING_DEVICE_QA**
- Full platform build/device gate: **PENDING_ENVIRONMENT**
- RC / Stable: **NOT AUTHORIZED**

PAX-02 adds keyboard/focus/dialog semantics, form accessibility bindings, touch-target and large-text hardening, plus Android Compose semantics. Payroll math, repository, storage, snapshot and backup cores remain frozen.

Next: **PAX-03｜Form Validation & Error Messaging**

## Previous frozen baselines
- `freeze/v4.3.0-dev.1` — v4.3.0-dev.1 Development Source Freeze
- `stable/v4.2.0-web` — previous Web Stable Freeze
