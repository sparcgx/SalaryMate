# SalaryMate

個人薪資與收入管理工具。

## Web Stable Release

**v4.2.1-web｜Full Data Import & Migration Stable Release**

整合範圍：
- v4.2.0-web Full Glass Stable 基線完整保留
- 完整歷史資料與紀錄 JSON 匯出
- Full Data Import & Migration
- 舊版 / Raw Web Canonical JSON 遷移
- 匯入前資料結構驗證與筆數預覽
- Transactional Rollback
- 跨瀏覽器 / GitHub Pages 本機資料搬移
- 無新增雲端資料上傳通道

## Release Gate

- v4.2.1-web-dev.1｜Local Data Export：PASS
- v4.2.1-web-dev.2｜Full Data Import & Migration：PASS
- v4.2.1-web-RC.1｜Release Gate：PASS
- Stable Promotion identity-only gate：PASS
- Network transport gate：fetch / XHR / sendBeacon / WebSocket / Supabase / Firebase = 0

## Stable Freeze

`stable/v4.2.1-web` 為 v4.2.1 Web 正式凍結基線。
後續功能需由下一版本分支開始，不直接修改 Stable branch。

上一個凍結基線 `stable/v4.2.0-web` 保留不動。

Repository 為 Public；SalaryMate 個人資料仍保存在各裝置 / 瀏覽器的本機儲存空間，不由 GitHub Pages 保存。
