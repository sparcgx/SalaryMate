# v4.3.0-dev.1｜Canonical Integration Baseline

## GitHub × GPT 工作站同步狀態

- Product line: `v4.3.0`
- Current implementation baseline: `v4.3.0-dev.1`
- Schema: `13`
- Android package: `com.salarymate.personal`
- Android versionCode: `14`
- iOS MARKETING_VERSION: `4.3.0`
- iOS CURRENT_PROJECT_VERSION: `2`

## Canonical source chain

- Initial canonical baseline: `a2ffbb29e1e7b52ab6ca9dc9b30a975bcd384ec894b632b69177559ef36d08c4`
- CM-01 R1: `e27adfb5dfbbd0224bbcc6d763211a60991e8d474c5650f77a5ae27d3472ccd9`
- CM-02 R1: `af1f7deec719283f75b8519dd4100a283ef10f9902807caebfef7c78cbdfbb9e`
- CM-03 R1: `4b5d0c78b85b4d8d54ba17769d9ab778727d4da600d3ae24f30708cf4604b4c4`
- **CM-04 R1 current source: `2a06eabb854b722f1f13b19f7e3a5e0b9a7be5f62bf2f52bfd3a8f906906746a`**

## CM-01｜Unified Version Foundation
**Targeted Gate: PASS**
- Version Drift: `0`
- Single human-maintained version source: `version.json`

## CM-02｜Company Management Shell
**Implementation Regression: PASS**
- Company selector: switch-only
- Second Company Store: `0`

## CM-03｜Simplified Salary Rules
**Implementation Regression: PASS**
- Salary Rules order fixed at 6 entries.
- Second Salary Rules Store: `0`.
- Tax / OT core unchanged.

## CM-04｜Advanced Company Rules Simplification
**Implementation Regression: PASS**

Advanced settings order:
1. 特殊薪資週期
2. 年度加薪
3. 年終規則
4. 其他特殊規則

Key contracts:
- Annual Raise reuses existing `salaryAdjustments`.
- Year-End reuses existing `yearEndEstimates`.
- Other Special Rules only exposes existing supported settings.
- Arbitrary Rule Engine: `0`.
- Second Advanced Rules Store: `0`.
- Schema: `13`.
- Version Drift: `0`.

Payroll period resolver:
- 1→月底: PRESERVED
- 16→次月15: PRESERVED
- 20→次月19: PASS
- 5→25: PASS; outside-range dates FAIL CLOSED
- February day clamp: PASS
- Native Kotlin cycle execution: `16 PASS / 0 FAIL`

Regression:
- Script gates: `19 PASS / 0 FAIL`
- PASS lines: `21`
- Product FAIL: `0`

Core:
- Storage: SAME
- Snapshot: SAME
- Backup crypto: SAME
- Native backup: SAME
- Tax: SAME_BY_REGRESSION
- OT: SAME_BY_REGRESSION
- NativePayrollMath: intentional payroll-period resolver extension only
- NativeSalaryMateRepository: optional custom-cycle parsing only

Platform status:
- Web/shared regression: PASS
- Android NativePayrollMath execution: PASS
- Android full Gradle/device: PENDING_ENVIRONMENT
- iOS Hybrid shared shell: PASS_STATIC
- iOS Foundation parser: PENDING_ENVIRONMENT

## Remaining v4.3.0-dev.1 work

- CM-05 Company Workflow / Cross-Platform UX: **NEXT**
- CM-06 Full Regression / dev.1 Freeze: PENDING

PAX / RI / RC / Stable remain PENDING. This branch is **not** a Stable PASS declaration.
