# R99 Android 開發版驗證記錄

日期：2026-10-09。沿用既有 Native Validation Kit R1，接入目前 R99 完整網頁功能；網站來源、單一 HTML 與凍結 v4.3.2 未改動。

## 已完成

- 成功編譯、簽署 `SalaryMate_v5.0.0-dev.2-R99_Android.apk`，名稱「SalaryMate 開發版」。
- 套件 `com.salarymate.personal.dev`，versionCode `5000099`，Android API 24 以上、target API 36。與舊正式包的身份、資料儲存分開。
- 完整風格、背景、晶羽、魔法與所有 R99 網頁資源包含於安裝包。行情與 Drive 雲端文件仍需網路。
- JSON／CSV／HTML 保存透過系統文件供應者，長度與 SHA-256 讀回一致後才報告成功。普通／加密備份保留原 R99 驗證預覽；Android 一般匯入另允許舊 `.salarymate`。
- 自己的 Google Drive 改由 Android 文件選擇器存取；沒有內嵌 Google OAuth、網站版 API 清單或自動同步。
- 私人開發簽章另行備份，未加入原始碼、網站或 APK。

## 程式驗證

- 新增 Android JavaScript／WebCrypto／Node callback 測試：16/16 PASS；含格式邊界、錯誤密碼、取消、儲存驗證與 Schema 13 → 15。
- 既有原生單元測試：7/7 PASS（6 項舊原生核心回歸＋1 項既有算術檢查）。R99 主功能仍使用原網頁核心。
- 最終 `:app:assembleRelease :app:testReleaseUnitTest`：BUILD SUCCESSFUL。Kotlin／Java 編譯與 Release lint 完成；保留既有非阻斷警告。
- APK v2 簽章驗證 PASS；ZIP 完整性、54 個資產長度及 SHA-256、版本／launcher／本機 HTTPS 路由、原生 CSP 與啟動順序全部通過。
- ZIP 的 16 KB 對齊檢查 PASS；8 個原生 `.so` 的 PT_LOAD 對齊檢查 PASS。GNU_RELRO 結尾有嚴格檢查差異，但向 16 KB 上取整後未覆蓋其他可寫 LOAD；不因此宣稱 16 KB 裝置運行通過。既有 SQLCipher／graphics-path 庫與依賴版本均未更換。
- R99 網頁 JavaScript／CSS、單一 HTML CSP 精確雜湊與 56 個凍結檔案仍通過原 preflight。
- 未使用虛擬瀏覽器、Playwright、CUA 或 Android 模擬器。

APK 大小：47838787 bytes。
APK SHA-256：`d5b908a5455e134920fa82cde9a6c749d505751f4f079c4206fe2929706aa55e`。
簽章憑證 SHA-256：`f8fd14dcf2a0fceb654bbdaacaf9c73bbd5a6d61088ea7b48bf9139c11107877`。

## 實機待驗證

安裝、首次開啟／重開、App 私有資料保留、普通與加密備份往返、系統返回、照片與 SmartPortfolio 匯入、自己的 Drive 讀寫、實際行情連線、手機／寬螢幕畫面、晶羽／魔法觀感、開啟秒數與 FPS。16 KB 裝置需另行驗收。

特定雲端文件供應者若不支援寫入後立即讀回，程式會報驗證失敗，不能宣稱已上傳成功；接近 45 MB 匯出時也需在低記憶體設備確認耗時。

請先在原網站或舊 App 匯出備份，於開發 App 選取、核對預覽後匯入；資料不會自動跨 App／瀏覽器搬移。首次安裝後，用測試資料完成新增、重開與備份往返，再驗收真實資料。
