# v4.3.3-dev.1 合規修訂驗證

- Web 功能回歸：55 PASS / 0 FAIL（開發版資產）。
- Android 來源功能回歸：57 PASS / 0 FAIL。
- 新增授權入口與資產驗證：2 PASS / 0 FAIL。
- 備份、匯入、AES-GCM、SQLite 保存、10 項來源端故障注入：PASS。
- Android 新版 APK 建置／簽章／實機：未執行。
- iOS：PAUSED，工程維持基線。
- 開發 PWA 使用獨立快取命名，不清除正式版快取。
- 薪資公式、儲存核心及 Schema 13 未變更。授權入口閱讀不寫入薪資。
- 126 個已安裝 npm 套件／建置工具已收錄授權文字；非跨平台或 APK 完整 SBOM。
- SQLCipher 社群授權與 Apache 2.0 全文已收錄。
- 原生間接 AAR/JAR NOTICE 比對、商標與素材來源清查仍待完成。

GitHub v4.3.3-dev.1-compliance 為開發分支；main/stable/freeze 不晉升。
