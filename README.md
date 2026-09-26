# SalaryMate

個人薪資與收入管理工具。

## Current Frozen Development Baseline

**v4.3.0-dev.1｜CM-06 Development Source Freeze**

Canonical Source SHA-256:

`3020cf41e964e282ebb607366d224a65fc8106490109c22ebb88fbf2cc935605`

Identity:
- Product: `4.3.0-dev.1`
- Release target: `4.3.0`
- Schema: `13`
- Android: `com.salarymate.personal`, versionCode `14`
- iOS: MARKETING_VERSION `4.3.0`, build `2`

Gate:
- CM-01～CM-05 implementation regression: PASS
- CM-06 Development Source Freeze: **PASS**
- Node/source gates: **21/21 PASS**
- Kotlin native gate: **16/16 PASS**
- Product FAIL: **0**
- Full platform build/device: **PENDING_ENVIRONMENT**
- RC / Stable: **NOT AUTHORIZED**

CM-06 fixed one release-blocking Android context issue: an invalid/absent Current Company can no longer silently fall back to the first company.

See:
- `version.json`
- `docs/releases/v4.3.0/INTEGRATION_STATUS.md`
- `docs/releases/v4.3.0/CM-06_FULL_REGRESSION_DEV1_FREEZE.md`
- `source-packages/v4.3.0-dev.1/CM-06_R1_SHA256.txt`

## Previous Web Stable Freeze

**v4.2.0-web｜Full Glass Stable Release**

`stable/v4.2.0-web` and `main` remain the previous Web Stable baseline. They are not modified by the v4.3.0 development freeze.
