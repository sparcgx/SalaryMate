# SalaryMate

目前正式版本：**v4.3.2 Web Stable**（2026-09-30）。

- [GPT 工作站／正式網站](https://salarymate.sparcgx2420.chatgpt.site)
- [GitHub Pages](https://sparcgx.github.io/SalaryMate/)
- [發布紀錄與驗證範圍](RELEASE_GATE_v4.3.2-web_STABLE.md)

由使用者驗收 PASS 的 RC.3 晉升，保留月結核對、複製上月預覽、補休管理、年度同期比較與報表，以及手機搜尋列和橫向操作按鈕修正。正式晉升僅變更版本識別。

自動驗證：61 項測試與 6 項來源檢查 PASS。薪資資料保存在目前瀏覽器／裝置；Schema 13，儲存鍵 `salarymate_v310_state`。

Stable／Freeze：`stable/v4.3.2-web`、`freeze/v4.3.2-web`。歷史版本與驗證資料保留於 release-evidence。

本次僅為 Web／PWA Stable。Android／iOS 原生 Gate 與原生故障注入仍為 UNVERIFIED；原生資料安全 BLOCKER 仍為 OPEN。
