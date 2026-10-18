# v5.0.0 正式版 · Windows / macOS 桌面封裝 2

發布日：2026-10-19（Asia/Taipei）。正式名稱維持 v5.0.0，桌面 build 5000104。

沿用既有網站來源與計算模組；資料 KEY salarymate_v5_full_state／Schema 15。未修改網站 110 個既有檔案、凍結版及 Pages 的正式入口。

## 發布與來源

- GitHub Release：https://github.com/sparcgx/SalaryMate/releases/tag/v5.0.0-desktop.2
- 成功工作流程：https://github.com/sparcgx/SalaryMate/actions/runs/39175495982
- 安裝包 GitHub 來源提交：63f3d4ce2a199126e264a0d34aca888305c88f57
- 對應 Sites 來源提交：69d81f6cb8e1fc79958fe39c1e9cd273745bf788

| 安裝檔 | bytes | SHA-256 |
| --- | ---: | --- |
| SalaryMate_v5.0.0_win_x64.exe | 139854786 | e804529f36a3a79352566913630daed5e167ae7b8a5e45683bd83d16c4ec228e |
| SalaryMate_v5.0.0_mac_arm64.dmg | 157079472 | 21d7352e3c628ad1fb51c51d5cff6563dabea674ffe27bcb577b8c83ebcf834f |
| SalaryMate_v5.0.0_mac_x64.dmg | 162631151 | d0b38ba1025e14109f030b4dba691ec2244f15bc811785c4b15c433f2f9c3f32 |

## 程式驗證

- 本機 12 項桌面檢查與 27 項公開參考、既有公式及舊備份回歸，共 39/39 PASS。
- Windows 與兩個 macOS 架構，各自 12/12 桌面檢查 PASS；三個安裝包均通過 ASAR 全部 56 份素材、5 個 API 模組、腳本語法及二進位架構核對。
- 兩份 DMG 通過 hdiutil verify；兩個 Mac App 通過 codesign --verify --deep --strict（ad-hoc）。
- 三個下載後 ZIP 及其中安裝檔 SHA-256 均與 Actions／Release 一致。
- Windows 換行格式與 ASAR 核對路徑分隔符差異已修正。Gitattributes 保留來源位元組，核對工具依平台正規化路徑。

## 限制與實機待驗證

- Windows 安裝包沒有發行者憑證；macOS 僅 ad-hoc 簽章，沒有 Developer ID／Apple 公證，首次執行可能受系統阻擋。
- Windows 10/11 x64；macOS 13 以上，分 Apple Silicon arm64 與 Intel x64。
- 沒有啟用瀏覽器、虛擬瀏覽器或模擬器。實際安裝、啟動、重開保存、備份往返、Drive、即時網路查詢與動畫 FPS 均待使用者實機驗證。
- Google Drive 透過使用者自己的 Drive 電腦版同步資料夾；本機寫入驗證不代表雲端同步完成，網站原 Google Drive 流程保持不變。
- 桌面版資料與網站、Android、單一 HTML 分開，先匯出再匯入核對。此工作沒有重建 Android APK。
- 完整安裝與重現步驟見 native-desktop/README.md。

桌面封裝 2 補上從 Drive 選取 UTF-8 BOM JSON 的相容處理：先核對原始位元組，再略過開頭 BOM，與網站 File.text() 行為一致；CSV 匯出仍保留 BOM。舊桌面封裝 1 的 GitHub Release 說明已導向新版。
