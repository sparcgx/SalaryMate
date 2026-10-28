# SalaryMate v5.3.2 Android 發布

日期：2026-10-29（台北時間）。使用者於此日期回報 APK 測試 OK，並要求更新公開下載。

公開檔案沿用已交付的 `SalaryMate_v5.3.2_Android.apk`，本次不重新編譯、不重新簽署。

- 大小：47,925,028 bytes。
- SHA-256：`628e131eca4dddbe4d77dddd6faa0bc62f94ac62bfa6eb08608f737ca1786d85`。
- 套件：`com.salarymate.personal.dev`；versionCode：`5030201`；Android 7.0 以上。
- 已完成 39 項 JavaScript、10 項 Android 單元測試，60 項資源雜湊核對、簽章及 ZIP 對齊檢查。
- 與已發布 v5.0.0／R101 的簽章相同，套件與 WebView 儲存來源相同，版本碼增加。

沿用 GitHub Pages `stable/v4.2.0-web` 分支的 `apk/` 下載頁。檔案分段放置於 `apk/data/v5.3.2-*.bin`；Sites 下載服務按序串流為完整 APK，避免整檔占用 Worker 記憶體。已發布 v5.0.0 的網址仍提供原始位元組。

安裝前先匯出備份，再覆蓋更新相同套件；不要先解除安裝或清除資料。
