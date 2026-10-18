# SalaryMate v5.0.0 正式版 · Windows / macOS

沿用已發布 v5.0.0 正式版（包含辦公日曆整合），桌面封裝 1，build 5000103。薪資與投資程式不重寫，資料 KEY `salarymate_v5_full_state`、Schema 15 維持一致。

## 安裝

- Windows 10／11 64 位元：開啟 `SalaryMate_v5.0.0_win_x64.exe`，選擇個人安裝位置。此包不要求系統管理員權限。
- macOS 13 以上 Apple Silicon（M 系列）：`SalaryMate_v5.0.0_mac_arm64.dmg`。
- macOS 13 以上 Intel：`SalaryMate_v5.0.0_mac_x64.dmg`。
- Mac 開啟 DMG，將 SalaryMate 拖到 Applications（應用程式），再從應用程式開啟。
- 尚未提供發行者簽章憑證。Windows 未有 Authenticode 簽章；Mac 只有 ad-hoc 完整性簽章，沒有 Apple Developer ID 與公證。首次安裝可能被系統阻擋；請核對下載來源與 SHA-256，不要關閉系統的整體安全保護。受管理的電腦可能需要管理員核准。

## 資料與升級

- Windows 資料：`%APPDATA%\SalaryMate`；Mac：`~/Library/Application Support/SalaryMate`。兩者都是使用者自己的本機資料。
- 網站、Android、單一 HTML 及各電腦的資料分開儲存。先在原入口匯出一般或加密備份，再到桌面版「設定 → 匯入備份」，檢查預覽後才確認匯入。
- 升級沿用相同應用程式 ID、資料目錄與儲存來源。Windows 解除安裝設定為保留 App 資料；手動刪除資料目錄仍會遺失資料。更換電腦前請匯出備份。
- 檔案匯出會先寫入暫存檔並讀回驗證，再取代你選定的檔案。取消／驗證失敗不會回報成功；驗證失敗保留原檔。
- 「自己的 Google Drive」使用 Google Drive 電腦版同步資料夾；需自行安裝並登入自己的帳戶。App 儲存完成只代表本機檔案驗證成功，雲端同步進度請看 Drive。沒有內嵌 Google 登入或自動合併資料；網站版原 Google Drive 流程保持不變。

## 離線、查詢與功能

介面、全部風格、背景、晶羽／魔法、政府辦公日曆與級距快照均包含於安裝包。重型內容仍在需要時讀取本機檔案，第一畫面不用下載網站。行情、淨值、配息與歷史匯率需要網路：桌面主程序沿用網站的公開資料查詢與驗證模組，僅傳查詢所需代號、日期與幣別；不傳公司薪資、持股數量、帳戶餘額或備份內容。此版不會自動下載執行新版程式，後續更新需安裝新版。

辦公日曆仍為政府機關參考，不能自動認定公司的休息日／例假或套用加班倍率。級距與日曆快照的核對日為 2026-10-16。

## 可重現建置

在既有 GitHub 開發分支執行 `.github/workflows/salarymate-desktop.yml`，Windows runner 產出 NSIS EXE，Mac runner 產出 arm64／x64 DMG。原始碼鏡像位於 `sites-source/`。本機建置時在此目錄依序執行：

```
npm ci --ignore-scripts
npm run assets
npm test
npm run package -- --win --x64
# Mac 上分別用 --mac --arm64 或 --mac --x64
npm run verify -- x64
```

套件鎖定 Electron 44.9.0、electron-builder 26.15.3。Electron 的 Chromium／第三方授權檔由打包器保留；應用程式既有授權說明也包含於離線包。

## 驗證範圍

程式測試涵蓋路徑限制、公開 API 路由、備份位元組／大小／取消／驗證失敗回復、原版計算模組雜湊、CSP、平台識別、封裝架構。CI 額外核對 ASAR 內全部素材、二進位架構，Mac 磁碟映像及 ad-hoc 簽章。

沒有使用瀏覽器、虛擬瀏覽器或模擬器。Windows／Mac 的實際安装、開啟、關閉重開、資料保留、備份往返、Google Drive 資料夾、即時行情網路及晶羽動畫觀感仍待實機驗證。程式通過不代表實機驗收或 FPS 通過。
