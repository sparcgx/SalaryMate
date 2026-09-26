# CM-05｜Company Workflow Simplification & Cross-Platform UX

Status: **IMPLEMENTATION REGRESSION PASS / FULL PLATFORM GATE PENDING**

## Workflow contract

Root navigation:
- 首頁
- 快速登記
- 薪資
- 年度總覽
- 公司管理
- 設定

Operational modules use one Current Company context. No current company means creation fails closed.

## Payroll creation

New payroll is fixed to:
1. 月份
2. 本月資料
3. 確認

Company identity is locked during the draft. Duplicate scope is `companyId + payrollMonth`. Month changes clear month-scoped transactions before continuing.

Existing payroll edit remains a separate safe edit path and cannot change company.

## Company scope safety

Web:
- payroll / overtime / leave forms no longer expose module-local company selectors
- scoped `companyId` is carried as hidden identity
- company switch clears scoped transient draft / selected state
- dirty draft blocks navigation / company switch until decision

Android:
- Quick Entry uses current company only
- Payroll uses current company only
- repository no longer falls back to the first company when current company is absent
- payroll draft Back requires discard confirmation

## Navigation

- Web History API Back/Forward is enabled only when the runtime supports it.
- Legacy/restricted WebView without `pushState` keeps existing navigation without crashing.
- Android system Back returns root destinations to Home.
- iOS Hybrid consumes the shared Web contract.

## Regression

- Executable script gates: **20**
- PASS messages: **22**
- Product FAIL: **0**
- Version Drift: **0**
- Schema: **13**

Core byte-identical to CM-04 R1:
- `NativePayrollMath.kt`
- `src/storage.js`
- `src/snapshot-store.mjs`
- `src/backup-crypto.mjs`
- `src/native-backup.mjs`

Intentional repository change:
- no fallback to first company
- payroll creation fails closed until current company is explicitly set

Environment pending:
- Android full Gradle / physical-device validation: `PENDING_ENVIRONMENT`
- iOS Foundation parser: `PENDING_ENVIRONMENT` because `xcode` npm module is unavailable
- iOS result gate: PASS

Source SHA-256: `8c6223328d96b7e180ff40f012db7330618658149268cde1259dbed863ae88d8`

Next: **CM-06｜Full Regression & dev.1 Freeze Gate**
