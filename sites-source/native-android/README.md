# SalaryMate v5.3.2 Android APK

將目前 v5.3.2 的完整網頁介面與原有 Android 整合一起編譯為已簽署 APK。包含漲跌金額、版本中心、台股／美股行情、智慧分析、小圖示、深色介面修正與星期六預設修正。

## 安裝與資料

- 套件身分維持 `com.salarymate.personal.dev`；versionCode `5030201`；versionName `5.3.2`。顯示名稱為「SalaryMate v5.3.2 正式版」，支援 Android 7.0（API 24）以上。
- 升級既有同身分 APK 必須使用原簽章，並直接覆蓋安裝。不要先解除安裝；建議先從舊版匯出備份。
- 保留相同 WebView 來源、`salarymate_v5_full_state` 儲存鍵與 Schema 15。瀏覽器及不同套件身分的舊 App 各自保存資料，請經備份匯出／匯入搬移。
- 支援既有 Schema 13 JSON 及原生巢狀 v1 加密 `.salarymate` 的解密、驗證及預覽。未知格式仍拒絕，不宣稱支援來源未定義的備份格式。
- JSON／CSV／HTML 匯出使用系統文件選擇器，寫入後讀回並核對 SHA-256；取消或失敗不回報成功。
- Android 的 Google Drive 入口使用系統文件選擇器。手機需先安裝並登入 Drive，再從文件位置清單選取；沒有背景自動同步。
- 此 APK 的升級方式是安裝新版 APK。Windows／Mac 的桌面內容更新套件不適用 Android。

## 離線與網路

介面與圖像素材內建於 APK，可離線記錄薪資與投資。行情、智慧分析近期資料、歷史匯率與 Drive 雲端存取需要網路。

同來源網路放行限於七個公開行情 POST 端點（quotes、nav、lookup、dividends、catalog、sessions、history）、公開歷史匯率 GET 端點及其 OPTIONS 預檢；拒絕將它們當成主頁開啟。其餘同來源 API 保持封鎖。查詢參數不包含使用者薪資或投資明細。

## 可重現建置

1. 使用 Node 22.13+、JDK 21、Android SDK API 36、Build Tools 36.0.0 及 Gradle 8.14.3。設定 `JAVA_HOME` 與 `ANDROID_HOME`。
2. 在此目錄執行 `npm ci --ignore-scripts`，再執行 `npm run android:sync`。素材來自 `../dist/dev/v5.0.0-dev.2/`，不可將使用者備份放進資源目錄。
3. 透過安全的本機設定提供四個簽章環境變數：`SALARYMATE_KEYSTORE_FILE`、`SALARYMATE_KEY_ALIAS`、`SALARYMATE_STORE_PASSWORD`、`SALARYMATE_KEY_PASSWORD`。不將金鑰或密碼提交到 Git、網站或 APK。
4. 在 `android/` 執行 `./gradlew :app:assembleRelease :app:testReleaseUnitTest :app:lintRelease`（Windows 使用 `.\gradlew.bat`）。未提供完整簽章時 Release 建置會拒絕繼續。
5. 在此目錄執行 `npm run android:check`。
6. 在專案根目錄執行 `python scripts/verify-android-apk.py /absolute/path/app-release.apk /absolute/path/report.json --baseline-apk /absolute/path/previous.apk`。檢查資源雜湊、來源一致性、APK 簽章、16 KB ZIP 對齊，以及舊版簽章／套件／儲存來源是否相同、版本碼是否增加。

產物位置：`android/app/build/outputs/apk/release/app-release.apk`。

## 驗收範圍

自動檢查涵蓋 Java／Kotlin 編譯、公開資料路由、原生薪資計算、備份解密與驗證、文件儲存成功／取消／失敗處理，以及簽署 APK 的資源完整性。JavaScript 回歸測試使用 Node callback spies 與 WebCrypto；不能代替手機實測。

實機仍需核對覆蓋安裝後資料保留、啟動／返回、普通與加密備份往返、文件供應者、實際行情連線及畫面。請先備份，再於手機安裝測試；不要將編譯成功描述成實機驗證完成。

## 歷史流程

以下 R101 為當時的功能等效重打包記錄，只供維護對照。v5.3.2 已調整原生網路路由及版本碼，必須使用上方完整編譯流程。

## R101 功能等效重構（2026-10-12）

本段使用已發布 R101 APK 為基準，保留原生類別與全部其他素材。上方 R99 是原生編譯套件的來源記錄；請勿將它與 R101 網頁混合後直接宣稱為 R101。詳見 `../R101-REFACTOR.md`。

1. 在專案根目錄執行 `node scripts/build-android-assets.mjs --baseline-apk /absolute/path/SalaryMate_v5.0.0-dev.2-R101_Android.apk`。原 APK 的 ZIP 與 manifest 雜湊會先驗證，舊加密備份 adapter 必須一致。
2. 執行 `node --test --test-concurrency=1 tests/v5-r101-android-refactor.test.mjs tests/v5-android-runtime.test.mjs tests/v5-r99-android-legacy-backup.test.mjs tests/v5-r99-android-package.test.mjs`。測試 fixture 是實際 R101 發布 adapter，使用 native callback spies 與 WebCrypto。
3. 設定 `ANDROID_HOME`（Build Tools 36.0.0）及 `SALARYMATE_SIGNING_CONFIG`（私人簽章備份內 signing.json 的絕對路徑）；keystore 可為同資料夾的相對路徑。
4. 執行 `python3 scripts/repack-android-apk.py /absolute/path/baseline.apk /absolute/path/native-android/www /absolute/path/output.apk`，再執行 `python3 scripts/verify-android-apk.py /absolute/path/output.apk`。只允許 adapter／資產清單更新，相同簽章與其餘項目完全一致後才替換輸出。
5. 目前同一版本名稱及 versionCode 是刻意保留的功能等效交付。未來功能升版需另增 versionCode，並以對應來源建置；不要把這個重打包路徑當成改 Java／Kotlin／manifest 的方法。

手機覆蓋更新與資料保留仍待實機驗收；不要先移除 App。
