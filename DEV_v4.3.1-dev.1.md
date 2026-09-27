# SalaryMate v4.3.1-dev.1｜匯入匯出與入口精簡

狀態：DEVELOPMENT / SOURCE GATE PASS / NATIVE BUILD GATES PENDING。此分支從 `stable/v4.3.0` commit `09120121080256ba29066af90be59ccf82bc1d0a` 建立；`stable/v4.3.0` 與 `freeze/v4.3.0` 保持不可變。完整可編輯 Source 位於 [`SalaryMate_v4.3.1-dev.1_Source.zip`](SalaryMate_v4.3.1-dev.1_Source.zip)，SHA-256：`810045baf63b0e927824163ad913591ed084c73b4fb58facf8c1ab16fd408483`。可直接開啟的單檔工作站：[`SalaryMate_v4.3.1-dev.1_Workstation.html`](SalaryMate_v4.3.1-dev.1_Workstation.html)，SHA-256：`816f4f1dfc01a8469257cde418c60b700cf9cb537da54ab5f1439b7baf12e542`。

根目錄舊 README 與 `docs/releases/v4.3.0/` 保留各階段歷史證據，其中早期的 PENDING 不代表正式發行的最新狀態。正式版 Identity 以根目錄 `version.json` 為準；本開發版 Identity 以 `app-source/version.json` 為準。

## 內容

- 開發 Identity：4.3.1-dev.1、Android versionCode 20、iOS build 8、Schema 13。新分支測試使用自己的開發 profile，保留 RC.2 三項 Kotlin compile fixes。
- 移除原生「快速登記」導覽與首頁快捷；Web 導覽改名「工時／出勤」。保留工時、請假與加班資料及管理頁。
- 資料入口改為「匯入／匯出」。預設 `.salarymate` 匯出不加密、不詢問密碼。使用者主動選擇時才用 AES-GCM 加密；舊加密檔匯入仍要求原密碼。未加密匯入驗證 Schema 13 與摘要，使用者確認後才寫入。BIN／.file 與舊 JSON 依內容驗證。
- 保留單一資料來源、跨公司隔離、三份 Snapshot 與 `.salarymate` 舊加密格式。NativePayrollMath、NativeSalaryMateRepository、storage、snapshot-store、backup-crypto 的 hash 與凍結 Source 相同。
- Web 工作站位於開發分支的 [`workstation/v4.3.1-dev.1/`](workstation/v4.3.1-dev.1/)，採專用瀏覽器儲存命名空間 `salarymate_v431_dev1_preview:`，不讀寫同網域正式站的儲存鍵。正式站首頁與所有凍結分支內容未更動。

## Gate

| Gate | 結果 | 依據／限制 |
| --- | --- | --- |
| Frozen 分支同 commit | PASS | 本次 `git ls-remote` 比對 0912012。 |
| 開發 Identity／版本漂移 | PASS | `npm run test:source`。 |
| 核心 hash 隔離 | PASS | `scripts/v431-dev1-gate.mjs` 比對正式 Source manifest。 |
| 備份來源回歸 | PASS | `npm run test:source`；包含新未加密與既有加密路徑。 |
| Web 打包與 JS 語法 | PASS | `npm ci` 後 `npm run build`、`node --check www/bootstrap.js`。 |
| 工作站可編輯／打包檔同步 | PASS | Source ZIP 與八個打包後資源均在 `v4.3.1-dev.1` 開發分支。 |
| 單檔工作站靜態 Gate | PASS | JS 語法、版本、工時／出勤導覽、匯入匯出與獨立儲存鍵檢查。瀏覽器互動另列 NOT_RUN。 |
| GitHub Pages 公開預覽 | BLOCKED_CONFIGURATION | Pages 目前由舊 Web Stable 分支部署；為維持凍結基線，未將新版本寫入該分支或切換正式站來源。GitHub dev 分支提供打包資源，公開測試站由獨立 GPT 工作站承載。 |
| GPT 公開測試站部署 | PASS | 獨立 Sites 專案版本 1 部署成功：[`salarymate-v431-test.sparcgx2420.chatgpt.site`](https://salarymate-v431-test.sparcgx2420.chatgpt.site)；來源 commit `aec54ba301403ee4f07aef973732408dc9707dc8`。部署成功不等於互動測試通過。 |\n| 公開站瀏覽器載入 Smoke | PASS | 雲端瀏覽器開啟公開 URL，確認標頭 `v4.3.1-dev.1`、獨立儲存提示、工時／出勤與公司管理導覽正常呈現。 |\n| 匯入匯出互動與資料完整性 | NOT_RUN | 仍須實測匯入、匯出、密碼選用、跨公司隔離與取消時不寫入。 |
| Android Kotlin compile | PENDING_ENVIRONMENT | Gradle wrapper 無法下載 Gradle 8.14.3。 |
| iOS build／實機匯入匯出 | NOT_RUN | 需 Mac／實機。 |
| Android 實機匯入匯出 | NOT_RUN | 需先通過 Kotlin compile。 |
| 全平台正式 Gate | NOT_RUN | 本版仍是 dev。 |

下一步：於具備 npm 相依套件、Gradle 與 Xcode 的環境完成打包與編譯；分別實測未加密匯出／匯入、加密匯出、舊加密檔還原、錯密碼及取消時不寫入，再執行跨公司與 Snapshot 回歸。
