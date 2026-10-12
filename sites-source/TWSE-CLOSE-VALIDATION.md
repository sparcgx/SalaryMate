# TWSE 收盤價第一階段：本機驗證紀錄

基準：實際 Sites R100 / version 136，HEAD `f2b839a37383399923280eba32cf103107498dd8`。GitHub dev 尚是 R99，本次未以該分支取代新來源。未 push、merge、deploy、公開發布、重建 APK 或修改下載入口。

## 變更

- `server/twse-close.mjs`：固定官方網址整批讀取；同一 Worker instance 共用 5 分鐘快取、單一進行中請求、失敗後 60 秒重試間隔。逾時 10 秒、回應上限 2 MiB。保留最後成功快取與其抓取時間；不是跨 instance 的持久快取。
- 嚴格驗證民國日期及台北當日上限，拒絕混合、缺失、無效、未來或倒退的批次日期。休市時保留來源交易日。前導零／英數代碼保留；空白、非數字、零與負收盤價為 null，不當作零元。
- `server/stock-market.mjs`：沿用既有 quotes／lookup／catalog 與 portable 端點。同日有效 TWSE 收盤優先，較新交易日可用成交價；TPEx、美股、匯率、NAV 沿用既有流程。過期 TWSE 快取對外不提供可套用價格。
- 相容性權衡：TWSE 收盤來源失效時，包括 cold start，暫停 TWSE MIS 替代價，避免舊 Android 把已存收盤價降為同日較早成交。TPEx MIS 不受此限制。這是保守的故障處理，不是新增來源或重構。
- `stocks-integrations.js`：更新及 lookup 表單保存共用驗證，拒絕無效／過期／較舊報價及不合理時間。同日已存 TWSE 收盤不降級為成交價；同日已存帶時間的成交價也不被只有日期的收盤覆蓋。較新交易日可更新。
- `stocks-ui.js`：行情欄顯示來源與完整資料日期；市場資訊收合時仍顯示更新失敗提示；提供官方來源、授權及收盤說明。沿用既有更新按鈕與排程。語系及 startup bundle 已重建。
- `scripts/build-stock-worker.mjs` 納入新模組。Schema 15、storage keys、交易紀錄、歷史匯率／FIFO 成本、備份格式均不變。

來源：[官方 API](https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL)、[資料集](https://data.gov.tw/dataset/11549)、[授權條款](https://data.gov.tw/license)。公開實測 1,380 筆，日期 1151008／2026-10-08，1,364 有效收盤、16 null。Origin GET 回 200 但無 ACAO，因此續用可信後端；沒有新增 proxy、金鑰、權限或付費資源。

## 實際驗證

- 直接相關回歸 **109/109 PASS**：新 parser/cache 15、整合 14，另含 NAV、同步、持股、資安、儲存、R100 備份。無 skip。
- 股票全套 **19/19 PASS**；單一 HTML **5/5 PASS**。三項舊測試修正為可見 JSDOM、目前 startup bundle／SW，以及既有 includeFx payload；金額、資料及隱私斷言保留。修前失敗已在 untouched R100 重現並保存證據。
- Worker、驗證用單一 HTML 建置成功；8 項 JavaScript syntax check、git diff --check 成功。沒有 npm lint 指令。
- 打包 Worker 實際 regular／portable fixture 查詢通過，同批只抓取一次 TWSE；頁面含 CSP。19 個 tracked stable 根目錄檔案依 Git Windows 換行規則與 HEAD 位元組一致。
- **npm test：57 PASS／4 FAIL**。既有 stable432-freeze-pwa 凍結清單／cache 預期失敗仍在；後續串接 stable site gate 未執行，不能宣稱整套全綠。
- Chrome 合成資料 360px 框：內容 clientWidth／scrollWidth 皆 345px（扣捲軸），收合錯誤可見，來源／授權可展開，收盤日期可讀。既有寬表格保留內部橫向捲動；模擬失敗後價格／市值未變。此為真 CSS＋股票模組的元件预覽，不等同完整線上／手機端到端。
- 獨立審查曾重現「已存收盤 120 被同日 MIS 110 降級」，修後快取失效、cold start、舊 server 回應、lookup 保存及次日更新皆通過。

證據在 task/evidence/twse-close：final-regression.log、v5-stocks-corrected.log、v5-single-html-corrected.log、npm-test.log、worker-smoke.json、parser-public-fixture-check.json、stock-day-all-response.json、baseline 驗證紀錄及 mobile-close-date.jpg。該處單一 HTML 僅供驗證，不是新版下載。

## 線上更新步驟與限制

1. 取得發布授權後，再查最新 Sites 版本／來源並整合這份補丁，避免覆蓋其他進度。
2. 配置新 revision，更新開發入口 asset query、SW cache／版本及 release notes，重建 frontend／Worker。R100 asset URL 是 immutable，不能直接用相同網址發布不同 bytes。本輪未編新版本。
3. 只部署現有 Sites Worker 與開發入口；保留 stable 根目錄及既有 regular／portable allowlist，再驗證 CSP、origin、來源日期、故障保留。
4. Android 現有 APK 共用該 backend，但新 UI 與 client guard 不在現有 APK。Sites checkout 的 native scripts 與另一 SalaryMate 目錄內的 Android R100 修復仍需於未來授權 APK 工作中整合，保留 package／簽章／資料。本輪僅檢查相容性。

未執行：部署、Android／emulator／手機實測、真實跨交易日與 live 混合來源瀏覽器端到端。4 項 stable 失敗仍為已知限制。前述元件預覽沒有外部行情請求或使用者資料儲存。
