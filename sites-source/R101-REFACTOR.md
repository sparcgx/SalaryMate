# R101 功能等效重構 — 2026-10-12

## 基準與範圍

同一個 Sites 專案，來源基準 `ecf0d006c9d3d65318d4451dc548998bceb53459`。實際發布的 R101 Android APK SHA-256：`d679fb2f10aef369d664a2eb5cf6145f0aea85d21dc7c08dcae5d85a8b12269c`。

發現原始碼鏡像內的 Android adapter 仍是 R99，而已發布 R101 包含延後取得 native Plugins、頁面／對話框有效性、逐段 Base64、無完整副本的 UTF-8 長度檢查、精確讀回大小等保護。因此先從實際 APK 取回 adapter 作為行為基準；沒有以舊版覆蓋這些保護。

本次整理：

- 共用錯誤標籤只解析目前需要的一項，維持動態繁中／英文文字與未知錯誤的原處理。
- 共用備份檔名、JSON 儲存驗證及成功訊息，保留原始 JSON、加密時機、密碼清除與 UTC 日期命名。
- 共用對話框有效性與選取後匯入驗證，保留 busy lock、pagehide、重新開啟面板及原有 Promise 完成順序。
- 打包器可從已驗證 APK 取回既有素材；拒絕網站與原生版本混用，並避免舊 R99 配置默默產生錯版。
- 重打包只允許 Android adapter 與資產清單改變；核心程式／介面／圖片／原生類別／權限若變動就拒絕。完成簽章、對齊與完整比較後才替換輸出，失敗保留上一份有效檔案。

## 功能與資料契約

APK 的 applicationId `com.salarymate.personal.dev`、versionName `5.0.0-dev.2-R101`、versionCode `5000101`、minSdk 24、targetSdk 36 與原發布版完全相同。此次標示為 R101 Refactor，沒有修改畫面版本、資料 Schema 15、儲存鍵 `salarymate_v5_full_state` 或備份格式。

原生 .dex、.so、權限、介面及其他素材共 563 個 ZIP 項目保持位元組相同；僅 `assets/public/android-runtime.js` 及 `assets/public/android-asset-manifest.json` 改變。Java／Kotlin 未重新編譯，既有原生類別保留。

Sites 現行 R101 網頁來源與發布 APK 本來就有部分備份檢查與翻譯差異；本次 APK 以實際已發布內容為準，沒有將網站的新段落混入 APK，亦沒有改動網站業務核心。兩者仍各自保存資料；Drive 沿用手動系統文件選擇器。

## 程式驗證

- 61/61：23 個 R101 前後等效測試（116 個中英文與邊界情境）、6 個 Android adapter 回歸、8 個舊備份／加密相容、2 個打包契約、5 個薪資小數／月份回歸、17 個 TWSE 快取測試。
- 4/4：R101 發布、實際打包內容、凍結根目錄及健康端點。合計本次選定範圍 65/65 PASS。
- 實際 v2 簽章、與原 R101 相同的憑證、56 個資產長度與 SHA-256、ZIP 完整性／16 KB 對齊、aapt2 完整 badging 相等、563 個保留項目核對通過。16 KB 對齊屬靜態包裝檢查，不代表 16 KB 裝置執行通過。
- 故意替換 app.js 並更新其 manifest 雜湊仍會被拒絕；前一份已驗證 APK 的 SHA-256 保持不變。
- 網站 Worker 與完整單一 HTML 建置成功；另外核對語法、CSP 精確雜湊、既有網頁與正式版檔案。
- 不宣稱全專案 npm suite 通過；DOM 模擬／瀏覽器測試未執行，也未使用 Playwright、CUA、JSDOM 或 Android 模擬器。

輸出 APK SHA-256：`0b31210c72cfae831cbb64789429f8587c8b42905b5201e545d8593d35c0a701`；47842699 bytes。
相同憑證 SHA-256：`f8fd14dcf2a0fceb654bbdaacaf9c73bbd5a6d61088ea7b48bf9139c11107877`。私人金鑰沿用既有備份，未加入原始碼、網站或 APK。

## 實機待驗證

安裝／覆蓋更新、重開後資料保留、文件供應者與 Drive 寫入後讀回、返回／取消、動畫觀感、實測開啟時間／FPS 及 16 KB 裝置。此次程式等效與資產核對不能代替手機實機驗收。
