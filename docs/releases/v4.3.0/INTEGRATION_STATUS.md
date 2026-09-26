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
- **CM-03 R1 current source: `4b5d0c78b85b4d8d54ba17769d9ab778727d4da600d3ae24f30708cf4604b4c4`**

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

Salary rules order:
1. 基本薪資
2. 固定收入
3. 加班規則
4. 獎金
5. 加項／扣項
6. 稅務

Key contracts:
- Basic Salary / Fixed Income reuse existing `salaryAdjustments` effective snapshots.
- General bonus remains a monthly transaction.
- One-time additions / deductions remain monthly transactions.
- Year-End stays separate and belongs to Advanced Rules.
- Tax summary references existing core only; no second tax formula.
- Second Salary Rules Store: `0`.
- Schema: `13`.
- Version Drift: `0`.

Regression:
- Executable script commands: `18`
- PASS lines: `20`
- Product FAIL: `0`

Core unchanged:
- NativeSalaryMateRepository: SAME
- NativePayrollMath: SAME
- storage: SAME
- snapshot: SAME
- backup crypto: SAME
- native backup: SAME

Platform status:
- Web/shared regression: PASS
- Android source summary: PASS_STATIC
- Android compile/device: PENDING_ENVIRONMENT
- iOS Hybrid shared shell: PASS_STATIC
- iOS Foundation parser: PENDING_ENVIRONMENT

Environment-pending items are not product failures and remain for later platform gates.

## Remaining v4.3.0-dev.1 work

- CM-04 Advanced Company Rules: **NEXT**
- CM-05 Workflow / Cross-Platform UX: PENDING
- CM-06 Full Regression / dev.1 Freeze: PENDING

PAX / RI / RC / Stable remain PENDING. This branch is **not** a Stable PASS declaration.
