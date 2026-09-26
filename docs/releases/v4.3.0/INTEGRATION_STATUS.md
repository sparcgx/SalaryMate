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
- CM-04 R1: `2a06eabb854b722f1f13b19f7e3a5e0b9a7be5f62bf2f52bfd3a8f906906746a`
- **CM-05 R1 current source: `8c6223328d96b7e180ff40f012db7330618658149268cde1259dbed863ae88d8`**

## CM-01｜Unified Version Foundation
**Targeted Gate: PASS**
- Version Drift: `0`
- Single version source: `version.json`

## CM-02｜Company Management Shell
**Implementation Regression: PASS**
- Company selector: switch-only
- Second Company Store: `0`

## CM-03｜Simplified Salary Rules
**Implementation Regression: PASS**
- Salary Rules order fixed at 6 entries.
- Second Salary Rules Store: `0`.
- Tax / OT core preserved.

## CM-04｜Advanced Company Rules Simplification
**Implementation Regression: PASS**
- Advanced Rules order fixed at 4 entries.
- Native payroll-cycle execution: `16 PASS / 0 FAIL`.
- Arbitrary Rule Engine: `0`.

## CM-05｜Company Workflow Simplification & Cross-Platform UX
**Implementation Regression: PASS**

Root navigation:
1. 首頁
2. 快速登記
3. 薪資
4. 年度總覽
5. 公司管理
6. 設定

Workflow / context:
- one Current Company context across operational modules
- no-current-company fallback: `0`
- operational module-local company selector: `0`
- company switch clears scoped transient state
- dirty draft blocks company switch/navigation until decision

Payroll creation:
1. 月份
2. 本月資料
3. 確認

- company locked during create draft
- duplicate scope: `companyId + payrollMonth`
- month-scoped transactions reset when month changes
- existing payroll edit cannot move records across companies

Navigation:
- Web browser Back/Forward: PASS_TARGETED
- Legacy/restricted WebView without History pushState: PASS
- Android root Back: PASS_STATIC
- Android payroll draft discard guard: PASS_STATIC
- iOS Hybrid shared workflow: PASS_STATIC

Regression:
- executable script gates: `20`
- PASS messages: `22`
- Product FAIL: `0`
- Schema: `13`
- Version Drift: `0`

Core isolation:
- NativePayrollMath: SAME
- Storage: SAME
- Snapshot: SAME
- Backup crypto: SAME
- Native backup: SAME
- NativeSalaryMateRepository: intentional fail-closed Current Company change only

Platform status:
- Web/shared runtime regression: PASS
- Android source/static contract: PASS
- Android full Gradle/device: PENDING_ENVIRONMENT
- iOS result gate: PASS
- iOS Foundation parser: PENDING_ENVIRONMENT

## Remaining v4.3.0-dev.1 work

- CM-06 Full Regression / dev.1 Freeze: **NEXT**

PAX / RI / RC / Stable remain PENDING. This branch is **not** a Stable PASS declaration.
