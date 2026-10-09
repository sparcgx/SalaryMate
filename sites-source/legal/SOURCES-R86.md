# R86 素材與資料來源紀錄

核對日期：2026-10-09。適用：v5.0.0-dev.2-R86 網頁與單一 HTML。
這是來源與缺口紀錄，不是全部權利已確認的聲明。未更改任何私人資料保存位置。

## 已找到明確開放授權的資料集

| 資料集／來源 | 使用位置 | 核對依據與範圍 |
| --- | --- | --- |
| 金管會證期局／臺灣證券交易所：上市個股日成交資訊 | `server/stock-market.mjs` 的 `STOCK_DAY_ALL` 盤後資料 | https://data.gov.tw/dataset/11549 標示政府資料開放授權條款第 1 版、每日更新、免費，並連結 TWSE OpenAPI 說明 |
| 金管會證期局／證券櫃檯買賣中心：上櫃股票收盤行情 | `server/stock-market.mjs` 的 `tpex_mainboard_daily_close_quotes` 盤後資料 | https://data.gov.tw/dataset/11371 標示相同開放授權及 TPEx OpenAPI 說明 |

上述資料依 https://data.gov.tw/license 提供；顯名包含原提供機關、資料集名稱及授權連結，行情列保留資料日期及來源。此範圍不涵蓋即時行情、公司商標或其他資料集。API 對應與使用範圍應於來源變更時重新核對。

## 仍待確認的公開展示與轉供權限

| 來源 | 目前用途與端點 | 待補依據 |
| --- | --- | --- |
| TWSE MIS | `https://mis.twse.com.tw/stock/api/getStockInfo.jsp`：盤中最新成交 | 依 https://www.twse.com.tw/zh/products/information/use.html 逐項核對公開展示及轉供條件，不能以盤後開放授權推定 |
| Nasdaq | `https://api.nasdaq.com/api/quote/{symbol}/info`：美股名稱、行情、分類 | 本端點的適用條款與公開轉供授權；不將 Nasdaq Data Link 等不同產品條款當成本端點授權 |
| TWSE／TPEx 公司與 ETF 基本資料 | `t187ap03_L`、`mopsfin_t187ap03_O`、`t187ap47_L` | 各資料集的授權與顯名依據，不能從另一資料集推定 |
| TWSE／TPEx 配息公告及歷史資料 | `TWT48U_ALL`、`tpex_exright_prepost`、`ETF/etfDiv`、`api/etfExDiv`、`TWT49U`、`TWT49UDetail` | 各資料集或網頁 API 的適用條款與轉供範圍 |
| TWSE e添富 | `https://www.twse.com.tw/zh/ETFortune/ajaxEtfInfoChart`：公告淨值 | 網頁資料/API 再利用依據 |
| 群益投信 | `https://www.capitalfund.com.tw/CFWeb/api/etf/nav`：盤中預估淨值 | 投信資料公開展示／轉供依據 |
| 富邦投信 | `https://websys.fsit.com.tw/FubonETF/Trade/Estimate.aspx?area=TA`：盤中預估淨值 | 投信資料公開展示／轉供依據 |
| Frankfurter | `https://api.frankfurter.dev/v2/rate/usd/twd`：參考匯率 | 服務與上游匯率資料的適用條款與顯名範圍 |

本次保留既有行情功能，未新增資料來源或授權合約，也未取得上述項目的新授權。不能將此修訂宣稱為「可任意公開轉供行情」或「法律全部通過」。需要權利人確認的事項仍未結案。

## 圖示與生成素材

- 原內建三個公司／發行人圖示缺少可核對的使用權紀錄，已從目前 `stocks.js` 與新打包 HTML 移除，改用原有股票／ETF 通用圖示。未改寫使用者的 `auto`、`symbol`、`custom` 設定或自訂圖片。
- `ASSET-INVENTORY-R86.json` 記錄既有 21 個素材檔案的 SHA-256、可找到的生成提示詞與製作紀錄，以及被移除圖示的代號與摘要；不再次散布被移除圖示。
- 背景與晶羽採專案既有 AI 生成素材；有來源紀錄不代表獨占著作權或商標清查完成。沒有完整對應紀錄的舊素材明確標示待核對。
- 自訂圖示維持使用者本機／自己的備份流程；上傳入口提醒需有使用權。
- 歷史 Git 提交與凍結版本維持原狀，本次不重寫版本歷史。

## 隱私、公開截圖與宣傳

資料預設保存在目前瀏覽器；Google Drive 備份只傳至使用者授權的帳戶。Sites、Pages 與單一 HTML 的程式版本同步不會自動同步個人紀錄。切換入口前先匯出備份，匯入並核對後再清理舊資料。

公開示範僅使用虛構公司、帳戶與財務資料。本次沒有將使用者對話中的截圖或私人紀錄加入專案。不得將 Node 程式回歸或生成 HTML 位元組數宣稱為實機 FPS、網站下載量或手機完整驗收。

原生 Android 依賴及 APK 授權清查屬於歷史原生專案範圍，並非本次網頁驗證結果。
