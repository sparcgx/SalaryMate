SalaryMate **v5.0.0 正式版**，Windows / macOS 桌面封裝 2。沿用現有薪資、投資、備份、全部風格與晶羽；包含最新政府辦公日曆整合。

| 電腦 | 安裝檔 |
| --- | --- |
| Windows 10/11，64 位元 | `SalaryMate_v5.0.0_win_x64.exe` |
| Mac，Apple Silicon（M 系列），macOS 13+ | `SalaryMate_v5.0.0_mac_arm64.dmg` |
| Mac，Intel，macOS 13+ | `SalaryMate_v5.0.0_mac_x64.dmg` |

Mac 請將 App 拖到 Applications。Windows 依安裝精靈操作。

**資料搬移**：桌面版與網站／Android 的資料各自儲存。先在原入口匯出備份，於桌面版設定匯入，預覽核對後確認。Google Drive 使用自己的 Drive 電腦版同步資料夾，雲端同步狀態由 Drive 顯示。

**簽章狀態**：Windows 尚無發行者憑證；Mac 為 ad-hoc 簽章，尚無 Apple Developer ID／公證。首次開啟可能被系統阻擋。請核對來源與附檔 SHA-256，勿關閉整體系統防護。

**程式驗證**：備份、資料邊界、完整素材、CSP、安裝包架構及 Mac 映像完整性。`verification-*.json` 記錄各包的版本、來源與 SHA-256。

**實機待驗證**：Windows／Mac 安裝、重開保存、備份往返、Drive、網路行情與動畫流暢度。尚未宣稱實機或 FPS 驗收通過。

桌面封裝 2：從 Drive 電腦版同步資料夾選取 UTF-8 BOM JSON 時，先驗證原始位元組再略過 BOM，與網站 File.text() 的匯入行為一致。CSV 匯出的 BOM 保持原樣。
