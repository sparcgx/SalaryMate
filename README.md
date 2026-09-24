# SalaryMate

個人薪資與收入管理工具。

## Web 版本線
- **main baseline:** v4.2.0-web-dev.1｜SalaryMate Glass UI Foundation
- **current branch:** v4.2.0-web-dev.2｜Dashboard + Quick Entry Glass UX
- 原 Web 基線：v0.6.8 Write Integrity — 225 PASS / 0 FAIL
- dev.1 Glass Foundation：16 PASS / 0 FAIL
- dev.2 Dashboard + Quick Entry：24 PASS / 0 FAIL
- dev.1 → dev.2 JavaScript SHA-256：一致（Presentation Layer only）

## dev.2 範圍
- Dashboard 資訊層級重新整理
- Quick Tasks Glass UX
- 本月關鍵金額視覺層級
- Daily Quick Entry Glass 外殼 + 高對比輸入核心
- 手機／平板 Responsive 調整

## 凍結核心
不修改：
- 薪資計算
- Attendance / OT
- 多公司資料隔離
- Payslip / Snapshot
- OCR
- Backup / Restore
- 歷史資料格式

## 目錄
- `index.html` — 分支目前 Web App
- `versions/` — 封存版本
- `release-evidence/` — 驗證紀錄
