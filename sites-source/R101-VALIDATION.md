# R101 整合驗證 — 2026-10-10

## 範圍與基線

既有開發入口 `/dev/v5.0.0-dev.2/`，版本 `5.0.0-dev.2-R101`。Sites R100 原始基線為 `f2b839a37383399923280eba32cf103107498dd8`。

本次僅整合已核准的 TWSE 第一階段收盤價保護與加班／請假手機超框修正。保留 R100 備份、Google Drive 與啟動修復。正式 v4.3.2 根目錄、薪資公式、資料 Schema 15、儲存鍵與備份格式不變；不加入新的行情供應商。

- 收盤來源採嚴格日期／有效正價格檢查，空價不填零；來源失敗提供明確錯誤。伺服器在收盤來源失敗時保守保護舊客戶端，前端另保護已保存的同日收盤價。
- 移除出勤頁重複工具列包裝與固定選單寬度，手機改為標題下方完整寬度的篩選器；補上內容最小寬度、換行與窄版頂欄處理，保留深藍金框及可捲動的年度圖表。
- APP_VERSION、入口網址、SW SHELL/OPTIONAL/STYLE_PACKS 快取皆改為 R101。網站 startup 與 core CSS 由既有建置器重新產生。
- Worker 新增公開唯讀 `/api/health`，以 `no-store` 回傳服務與 R101 版本；不查詢持股或外部行情，不改變既有 quote 請求格式。

## 已執行

- `node scripts/build-stock-worker.mjs`：成功，108 靜態檔案。
- `node scripts/build-single-html.mjs <output> https://salarymate.sparcgx2420.chatgpt.site`：成功，31,825,550 bytes，15 個應用模組。
- `node --test tests/v5-r101-publication.test.mjs`：4/4 通過。確認發布入口、實際打包資產、快取與 style loader 版本一致；TWSE 和 UI 原始模組已包含；健康端點與正式根目錄位元組正確。
- app/startup/SW、stock-market/twse-close 與 build-stock-worker 六檔語法檢查、`git diff --check` 通過。專案未定義 lint 指令。

## 待其他驗證結果合併

完整相關測試、同基線既有失敗對照、合成資料瀏覽器驗證、部署確認、Android 建置與公開下載核驗由各自負責流程回填。本文件目前不宣稱部署或真機通過。

原始整合差異清單、測試與產物 hash 保存在本次 task 的 `evidence/r101/`。請使用最後部署／交付報告判斷實際發布狀態。
