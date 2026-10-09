# SalaryMate v5.0.0-dev.2-R99 Android 開發版

沿用既有 v4.3.2 Native Validation Kit R1 的 Capacitor／BridgeActivity Android 專案，將啟動畫面接至目前 R99 多檔網頁資源；沒有重建薪資、投資或計算架構。原始 v4.3.2 套件與凍結來源保持不變。

## 安裝與資料

- 開發套件：`com.salarymate.personal.dev`；versionCode `5000099`；versionName `5.0.0-dev.2-R99`。Android 7.0（API 24）以上，建議更新 Android System WebView。
- 安裝後名稱為「SalaryMate 開發版」，可與正式版並存。瀏覽器、舊正式 Android 與開發 APK 的資料各自保存，不會自動搬移或覆寫。
- R99 完整狀態使用 `salarymate_v5_full_state`／Schema 15，存於此 App 的 WebView 私有儲存。沒有清除儲存的升級步驟，沒有將薪資或投資明細送到其他人的服務。
- 舊版 Schema 13 JSON 與原生巢狀 v1 加密 `.salarymate` 可先解密、驗證並預覽，再確認匯入。未知格式仍會拒絕；目前來源未提供 `salarymate-simple-backup` 的規格，不能宣稱該包裝相容。
- 新匯出的普通及加密備份沿用 R99 格式。JSON／CSV／HTML 匯出透過系統文件選擇器，寫入後讀回並核對 SHA-256；取消或失敗不會報告成功。
- 自己的 Google Drive 使用 Android 文件選擇器：設備需已安裝並登入 Drive，再從位置清單選擇自己的 Drive。此 Android 入口沒有網站版 API 檔案清單或自動同步，也不在內嵌 WebView 執行 Google OAuth 登入。

## 離線與網路

介面、所有風格、背景、晶羽與魔法素材皆包含於 APK。沿用 R99 先顯示首屏，以及選用後才讀取華麗風格的流程；本地素材不存在時不偷偷改下載遠端畫面。行情、淨值、配息查詢與 Drive 的雲端操作仍需網路。僅既有五個公開行情 API 會由本地攔截路徑放行；個人明細不會送至這些行情端點。

## 可重現建置

1. 使用 Node 22.13+、JDK 21、Android SDK API 36、Build Tools 35.0.0／36.0.0，以及既有 Gradle 8.14.3。
2. 在此目錄執行 `npm ci --ignore-scripts`，再執行 `npm run android:sync`。素材由上一層專案的 `dist/dev/v5.0.0-dev.2/` 產生，請勿把使用者備份放進資源目錄。
3. 設定四個既有簽章環境變數：`SALARYMATE_KEYSTORE_FILE`、`SALARYMATE_KEY_ALIAS`、`SALARYMATE_STORE_PASSWORD`、`SALARYMATE_KEY_PASSWORD`。使用此開發包相同的簽章才能覆蓋升級。
4. 在 `android/` 執行 `./gradlew assembleRelease`。未提供簽章時原有檢查會拒絕 Release；簽章不放在專案或 APK 中。
5. 回到專案根目錄，執行 `node --test tests/v5-r99-android-package.test.mjs tests/v5-r99-android-legacy-backup.test.mjs tests/v5-android-runtime.test.mjs`，以及 `python3 scripts/verify-android-apk.py /absolute/path/app-release.apk`。

## 驗收範圍

程式驗證涵蓋既有原生編譯、APK 簽章、完整資源雜湊、原生文件儲存／取消／驗證、返回保護、舊備份解密與 Schema 13 → 15，以及中英文 Drive 提示。原生 JavaScript 測試使用 Node callback spies 和 WebCrypto，沒有虛擬瀏覽器或 Android 模擬器。

手機安裝、重開後資料保留、文件供應者、實際行情連線、動畫觀感、開啟秒數與 FPS 均仍待實機驗收。請先測試：安裝後開啟、建立一筆測試資料再重開、普通／加密備份往返、Drive 文件選取、返回與對話框取消；之後再驗收晶羽、魔法及寬螢幕畫面。
