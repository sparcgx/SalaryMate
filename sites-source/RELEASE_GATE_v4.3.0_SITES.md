# SalaryMate v4.3.0｜正式網站發布紀錄

目標站點：`https://salarymate.sparcgx2420.chatgpt.site`  
來源：`SM_v4.3.0_Formal_Stable_R1.zip` 內的正式 `src/`，版本契約 `4.3.0`、Schema `13`。網站適配變更僅含正式站提示、PWA 註冊／快取、資產版本參數與原站靜態檔配置。凍結版核心程式 `app.js` 及 `styles.css` 的 SHA-256 與正式凍結包一致。

## 資料銜接

舊站 v3.11.1 使用瀏覽器的 `salarymate_v310_state`。新正式站沿用相同來源站點與相同資料鍵，不使用開發預覽命名空間；網站程式不執行清除瀏覽器資料操作。瀏覽器資料是否存在於特定使用者裝置，僅能由該瀏覽器驗證。手機 App 的本機 SQLite 資料不會自動同步到網站。

## 檢查

- `node tests/v430-site-gate.mjs`：PASS；版本、來源站點識別、儲存鍵、正式資產與 PWA 更新設定。
- `node --check`：`app.js` 與 `bootstrap.js` 語法 PASS。
- 正式凍結包內 `src/app.js`、`src/styles.css` SHA-256 與網站輸出相符。
- 原始碼備份匯入及儲存回歸：PASS（純程式檢查）。
- 實際線上發佈及裝置資料核對：以 Sites 發布結果和使用者瀏覽器驗收為準。

部署範圍只限指定正式站；不改寫 `stable/v4.3.0`／`freeze/v4.3.0` 的凍結來源。
