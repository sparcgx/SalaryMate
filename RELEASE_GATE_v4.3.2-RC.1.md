# SalaryMate v4.3.2-RC.1｜完整回歸與發布候選凍結

日期：2026-09-30（Asia/Taipei）

狀態：WEB RC / FEATURE FREEZE / AUTOMATED PASS。這是發布候選，尚未晉升正式 Stable。

## 範圍與基線
承接 v4.3.2-dev.4，Sites 來源基線為 `99f2c4f077eba7e0d9ee1fc2c366f2bb242dc0b7`。整合 dev.1 月結核對、dev.2 複製上月與預覽、dev.3 補休來源／餘額／到期／結算、dev.4 年度同期比較／收入結構／整合報表。

本次執行期僅更新版本字串與資產快取識別，沒有新增功能或調整薪資公式、資料結構、儲存鍵與安全流程。26 個發布資產（含既有歷史預覽檔）經版本字串正規化後，SHA-256 均與 dev.4 相符。歷史預覽路徑與歷史證據保留原版本，不作為 RC 入口。

## 自動回歸結果
- 完整套件：50 PASS／0 FAIL／0 SKIP。
- 來源一致性：4 PASS。
- JavaScript 靜態語法與 Git diff 品質檢查：PASS。
- 原有 40 項覆蓋：玻璃效果與偏好、月結核對、複製上月、補休帳本、年度比較及 CSV 安全。
- RC 新增 10 項覆蓋：資產凍結、PWA 快取安裝／更新／離線、主要頁面與資料保留、CSV／HTML 真正下載事件、JSON 備份確認／還原／重啟、損毀與寫入失敗復原、跨公司草稿失效、輸出跳脫。

上述使用實際應用程式碼搭配模擬 DOM、儲存及 Service Worker 環境；不代表原生 Android／iOS、真實瀏覽器視覺／效能或裝置離線更新已驗證。

## 使用者實機回報
| 版本 | 原回報範圍 | 狀態 |
| --- | --- | --- |
| dev.1 | 薪資明細 → 月結核對 | PASS，依使用者回報 |
| dev.2 | 各月薪資明細 → 複製上月薪資 | PASS，依使用者回報 |
| dev.3 | 工時／出勤管理 → 加班紀錄 | PASS，依使用者回報 |
| dev.4 | 實機測試（年度比較、收入結構與整合報表版本） | PASS，依使用者回報 |

歷次回報保留其範圍，不擴張成完整原生 Gate 或本次 RC 的實機通過證據。

## RC 最終實機驗收
| 編號 | 檢查 | 狀態 |
| --- | --- | --- |
| RC01 | 重新開啟網站／PWA，畫面顯示 v4.3.2-RC.1，既有公司、薪資與加班仍在 | PENDING |
| RC02 | 月結核對：一致可確認，金額或來源變更要求重新核對 | PENDING |
| RC03 | 複製上月：先預覽，變動項目重設，重複目標月阻止套用 | PENDING |
| RC04 | 補休來源、使用、到期與結算仍可查核，結算不重複加進收入 | PENDING |
| RC05 | 年度／公司／截止月切換與 CSV、列印 HTML 下載內容一致 | PENDING |
| RC06 | JSON 備份往返及重啟後資料一致；網頁／PWA 完成更新後斷線可開啟 | PENDING |

## 凍結與發布治理
工作站／網站發布 RC；GitHub 分支 `rc/v4.3.2-RC.1`，另建立同提交的 `freeze/v4.3.2-RC.1` 候選快照。凍結是版本治理約定，未宣稱已設定 GitHub 伺服器端分支保護。

不移動既有 Stable／Freeze、main 或 GitHub Pages 正式線。凍結後只接受可重現問題的修正，另建下一個 RC；正式晉升需獨立指示與對應驗收紀錄。

Android 原生 Gate：UNVERIFIED。iOS 原生 Gate：UNVERIFIED。資料安全 BLOCKER：OPEN。本次 Web 故障模擬通過不關閉上述狀態。

## 證據索引
- `release-evidence/v4.3.2-RC.1_results.json`：逐項測試結果、使用者回報、原生狀態與 RC 資產 SHA-256。
- `release-evidence/v4.3.2-RC.1_test.log`：TAP 原始結果及來源 Gate 輸出。
- `release-evidence/v4.3.2-RC.1_freeze.json`：dev.4 正規化資產雜湊及來源提交。
- 完整測試原始碼與重跑入口保存在 Sites 來源提交；命令 `npm run test:rc`。GitHub 根目錄為網站部署資產；證據中的 `dist/` 對應 GitHub 根目錄。
