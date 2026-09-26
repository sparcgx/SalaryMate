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
- **CM-02 R1 current source: `af1f7deec719283f75b8519dd4100a283ef10f9902807caebfef7c78cbdfbb9e`**

## CM-01｜Unified Version Foundation

**Targeted Gate: PASS — 16 PASS / 0 FAIL**

- `version.json` is the single human-maintained version source.
- Web / Shared / Android / iOS version bindings synchronized.
- Version Drift: `0`.

## CM-02｜Company Management Shell

**Implementation Regression: PASS**

- Script gates: `17`
- PASS lines: `19`
- Product FAIL: `0`
- Company selector: switch-only
- First company: auto-current
- Second company: does not auto-switch
- Company detail / basic edit: separated
- Minimal create fields: company name / base salary / employment start date
- Duplicate name / zero salary: warning paths
- Existing full company settings: preserved as compatibility entry
- Second Company Store: `0`

Core unchanged:
- NativePayrollMath: SAME
- storage: SAME
- snapshot: SAME
- backup crypto: SAME
- native backup: SAME

Platform build/device status:
- Web/shared regression: PASS
- Android source wiring: PASS_STATIC
- Android compile/device: PENDING_ENVIRONMENT
- iOS Hybrid shared shell: PASS_STATIC
- iOS Foundation parser: PENDING_ENVIRONMENT

Environment-pending items are not product failures and remain for later platform gates.

## Remaining v4.3.0-dev.1 work

- CM-03 Simplified Salary Rules: **NEXT**
- CM-04 Advanced Company Rules: PENDING
- CM-05 Workflow / Cross-Platform UX: PENDING
- CM-06 Full Regression / dev.1 Freeze: PENDING

PAX / RI / RC / Stable remain PENDING. This branch is **not** a Stable PASS declaration.
