# v5.0.0 正式版 · Windows x64 / Mac arm64 優化

桌面封裝 3，build 5000105。基準為桌面封裝 2（GitHub 63f3d4ce2a199126e264a0d34aca888305c88f57）。正式產品名稱、資料 KEY salarymate_v5_full_state、Schema 15、App ID 與使用者資料目錄均維持原樣。

## 改動與可核對的影響

1. **啟動與重讀**：原先開窗前匯入 5 個 API 模組（36,939 bytes），改為行情／匯率各自首次使用才初始化。並行請求共用初始化，失敗可重試。本機素材加入 SHA-256 ETag；相同條件式請求回 304、HEAD 無檔案讀取，新版雜湊不沿用舊內容。保留首屏與風格按需載入，不強制預載整套素材。
2. **檔案路徑**：Blob 匯出直接以 Uint8Array 經隔離 IPC 傳入主程序，移除 Base64 字串與解碼，保留 IPC 自身複製。UTF-8 JSON 與備份格式不變。寫入與讀回雜湊分段計算；讀回緩衝由整份檔案改為 256 KiB，SHA-256 全檔計算從 3 次減為 2 次。仍須寫入、fsync、讀回比對完全通過才 rename；失敗保留目的地原檔並清理暫存。
3. **封裝**：只排除 r61/r62 靜態晶羽與 r68 飛行共 3 張無引用的舊圖。建置時重新檢查文字引用，遇到引用即失敗，不靜默刪除。保留 r70 相容圖、r73 四張飛行圖、r74 晶羽、r76 攻擊姿態、所有風系魔法及 10 種背景。網頁資源 31,659,706 → 27,964,302 bytes，減少 3,695,404 bytes（11.7%）；這不是整個安裝檔的減幅。

## 程式驗證

- 18 項桌面測試及 27 項公開參考／公式／舊備份回歸，45/45 PASS（本機 Node）。
- 測試覆蓋二進位 IPC 邊界、切片／BOM、45 MiB 上限、分段及部分讀取、取消／損壞／截短／增長／rename 失敗回復、延遲初始化與重試、快取失效、素材／API 雜湊、CSP、資料目錄與目標架構設定。
- 網站 110 個追蹤檔案 SHA-256 全數未變。網站、單一 HTML、Android 不需因桌面封裝優化重建。Intel 桌面封裝 2 安裝檔保留。

## 可重現合成效能測量

`node native-desktop/scripts/benchmark.cjs <report.json>`：只用填充值測試資料，各尺寸／版本 3 個獨立 Node 程序，中位數。包含舊／新 Blob 編码、模擬 structured clone、主程序驗證與真實磁碟寫入讀回，不包含 Electron contextBridge、視窗或使用者檔案。基準算法保留於 benchmark 腳本，不進入 App 業務程式。

Linux x64／Node v24.19.0 容器結果：

| 測試大小 | 舊通道總耗時中位数 | 新通道總耗時中位數 | 舊／新程序峰值 RSS |
| --- | ---: | ---: | ---: |
| 1 MiB | 59.42 ms | 7.39 ms | 54,964 / 41,216 KiB |
| 10 MiB | 550.13 ms | 41.38 ms | 179,800 / 68,736 KiB |
| 45 MiB | 2,144.15 ms | 151.97 ms | 561,392 / 176,384 KiB |

這些數字只描述合成檔案通道，不代表所有備份功能、實際開啟速度、整個 App 記憶體或動畫 FPS。CI 另在 Windows x64／Mac arm64 產出各自的 performance JSON。

## 實機待驗證與限制

需於 Windows／Mac 實機驗收安装、升級保存、冷／暖啟動、備份往返、Drive 同步資料夾、行情／匯率及動畫觀感；未執行瀏覽器／虛擬瀏覽器／模擬器。Windows 仍未有發行者簽章；Mac 仍僅 ad-hoc 簽章，沒有 Developer ID／Apple 公證。macOS 最低 13；Mac M 系列原生 arm64，Windows x64。

優化依循 Electron 官方的按需初始化與避免主程序阻塞建議：https://www.electronjs.org/docs/latest/tutorial/performance 。IPC 仍遵循隔離橋接與 structured clone：https://www.electronjs.org/docs/latest/api/context-bridge 、https://www.electronjs.org/docs/latest/tutorial/ipc 。
