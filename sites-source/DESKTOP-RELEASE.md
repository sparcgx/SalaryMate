# v5.0.0 正式版 · Windows / macOS 桌面封裝 1

發布日：2026-10-19（Asia/Taipei）。正式名稱維持 v5.0.0，桌面 build 5000103。

沿用既有網站來源與計算模組；資料 KEY salarymate_v5_full_state／Schema 15。未修改網站 110 個既有檔案、凍結版及 Pages 的正式入口。

## 發布與來源

- GitHub Release：https://github.com/sparcgx/SalaryMate/releases/tag/v5.0.0-desktop.1
- 成功工作流程：https://github.com/sparcgx/SalaryMate/actions/runs/39174922986
- 安裝包 GitHub 來源提交：f4a8aa6cc8422dcbb4303d71ad6bc27e670ea50e
- 對應 Sites 來源提交：258facebba8fac8315dd72085129c3a17d5b3e57

| 安裝檔 | bytes | SHA-256 |
| --- | ---: | --- |
| SalaryMate_v5.0.0_win_x64.exe | 139854775 | e42219fcd8c7c92b81dcd10078818061ec2bc1152c82ed3b8c25a6292cf67642 |
| SalaryMate_v5.0.0_mac_arm64.dmg | 157079462 | a046617e3f53c9373a9123b0057d93a67e39ec3f945f6c453fa89cc4a73ecdc1 |
| SalaryMate_v5.0.0_mac_x64.dmg | 162631169 | d7e721bde1d38819e5b2084789bb855fcd652bb64e50d4cae5fcd9be4574934e |

## 程式驗證

- 本機 11 項桌面檢查與 27 項公開參考、既有公式及舊備份回歸，共 38/38 PASS。
- Windows 與兩個 macOS 架構，各自 11/11 桌面檢查 PASS；三個安裝包均通過 ASAR 全部 56 份素材、5 個 API 模組、腳本語法及二進位架構核對。
- 兩份 DMG 通過 hdiutil verify；兩個 Mac App 通過 codesign --verify --deep --strict（ad-hoc）。
- 三個下載後 ZIP 及其中安裝檔 SHA-256 均與 Actions／Release 一致。
- Windows 換行格式與 ASAR 核對路徑分隔符差異已修正。Gitattributes 保留來源位元組，核對工具依平台正規化路徑。

## 限制與實機待驗證

- Windows 安裝包沒有發行者憑證；macOS 僅 ad-hoc 簽章，沒有 Developer ID／Apple 公證，首次執行可能受系統阻擋。
- Windows 10/11 x64；macOS 13 以上，分 Apple Silicon arm64 與 Intel x64。
- 沒有啟用浏览器、虛擬瀏覽器或模擬器。實際安裝、啟動、重開保存、備份往返、Drive、即時網路查詢與動畫 FPS 均待使用者實機驗證。
- Google Drive 透過使用者自己的 Drive 電腦版同步資料夾；本機寫入驗證不代表雲端同步完成，網站原 Google Drive 流程保持不變。
- 桌面版資料與網站、Android、單一 HTML 分開，先匯出再匯入核對。此工作沒有重建 Android APK。
- 完整安裝與重現步驟見 native-desktop/README.md。
