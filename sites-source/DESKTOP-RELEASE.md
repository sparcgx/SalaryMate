# v5.0.0 正式版 · Windows x64 / Mac M 系列優化

發布日：2026-10-19。桌面封裝 3，build 5000105，正式產品名稱仍為 v5.0.0。

## 來源與發布

- Release：https://github.com/sparcgx/SalaryMate/releases/tag/v5.0.0-desktop.3
- 成功工作流程：https://github.com/sparcgx/SalaryMate/actions/runs/39262354361
- 安裝包來源 GitHub commit：7f00ab54250662ad3db2a1f140204addd2cecb1e
- 對應 Sites source commit：f22020763b54482cf12a14c2d963f716b7a9f423
- 後續只補上發布證據文件；二進位仍以上述來源提交為準。

| 安裝檔 | bytes | SHA-256 |
| --- | ---: | --- |
| SalaryMate_v5.0.0_mac_arm64.dmg | 153,513,580 | c7c21bd96690c1d5167a0658f66b8d553520cb61f33faf4497a069d394d232ce |
| SalaryMate_v5.0.0_win_x64.exe | 136,308,284 | 1bcc05aeff5eb9c2bbc1ac7d5fc508ea8aec58b9b17d0a1d3850f03fe2fb12a5 |

## 已完成與程式驗證

- 行情／匯率按需初始化、ETag 條件式快取、二進位匯出與 256 KiB 分段讀回驗證；移除 3 張無引用舊圖，保留全部現用背景、晶羽、飛行／魔法及相容圖。
- 本機 18 項桌面檢查 + 27 項公開參考／公式／舊備份回歸，共 45/45 PASS；兩個 CI 平台各 18/18 PASS。
- ASAR 內 53 份網頁資源、5 個 API 模組、6 個主程序／橋接腳本語法與二進位架構核對通過。
- Mac hdiutil verify 與 codesign --verify --deep --strict 通過（僅 ad-hoc，非 Developer ID）。
- 兩份 Actions ZIP 下載雜湊、內部安裝檔 SHA-256 與公開 Release digest 均一致。
- App ID、資料目錄、salarymate_v5_full_state、Schema 15、計算模組與備份格式維持原樣。
- 網站 110 個追蹤檔案 SHA-256 未變；Pages HEAD 保留 731373c68f5092d4f159ac657c1d699659f72bbc。網站／單一 HTML／Android 無須因桌面優化重建。

## 兩平台合成效能結果

各大小／版本 3 個獨立 Node 程序取中位數；只用合成資料，包含 Blob 編碼、模擬 structured clone、驗證與磁碟讀寫，不是 Electron 開窗或使用者實機測試。

| 環境 | 45 MiB 舊通道 | 45 MiB 新通道 | 舊／新程序峰值 RSS |
| --- | ---: | ---: | ---: |
| Windows x64 CI，Node v24.21.0 | 2,458.87 ms | 336.71 ms | 571,528 / 181,392 KiB |
| Mac arm64 CI，Node v24.20.0 | 1,632.67 ms | 101.12 ms | 593,680 / 189,216 KiB |

網頁資源總量減少約 11.7%；整份 Windows 安裝檔由 139,854,786 → 136,308,284 bytes，Mac arm64 由 157,079,472 → 153,513,580 bytes。不可將合成測試改善幅度解讀為整個 App 速度或 FPS 改善幅度。

## 保留與限制

- Intel Mac 安裝檔保持[桌面封裝 2](https://github.com/sparcgx/SalaryMate/releases/tag/v5.0.0-desktop.2)；本次只重建 Windows x64／Mac arm64。
- Windows 尚無發行者憑證；Mac 只有 ad-hoc 簽章，尚無 Apple Developer ID／公證。安裝可能受作業系統阻擋。
- Windows 10/11 x64；Mac M 系列 macOS 13 以上。沿用原生架構與相同本機資料目錄。
- 實機待驗證：安裝、升級保存、冷／暖啟動、備份往返、Drive 同步資料夾、即時查詢及動畫／FPS。未使用瀏覽器、虛擬瀏覽器或模擬器。
- Drive 寫入驗證只代表本機檔案已保存，雲端同步狀態請在自己的 Drive 電腦版確認。

詳細變更與重現方法見 DESKTOP-OPTIMIZATION.md、native-desktop/README.md。效能 JSON 與 SHA-256 已附於同一 Release。
