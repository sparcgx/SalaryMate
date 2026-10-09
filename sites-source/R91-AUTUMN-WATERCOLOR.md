# R91 — 秋天手帳水彩

新增獨立 `autumn` 風格，沿用既有版面設定、即時切換、介面偏好保存及備份流程。選用路徑：設定 → 顯示與操作 → 版面設定 → 秋天手帳水彩。未自動替換使用者原有風格。

水彩紙面、深棕文字、霧玫瑰／杏橘索引、和紙膠帶裝飾延伸至表頭、卡片、按鈕、表單、收合群組、對話框及風格預覽。金額採既有數字字體，損益、錯誤與警告保留語義色。主選單與頂部選單延續不透明表面。

## 背景

| ID | 場景 | 素材 |
| --- | --- | --- |
| cafe | 秋日咖啡館 | art/background-autumn-cafe-r91.webp |
| fuji | 富士山 | art/background-autumn-fuji-r91.webp |
| desert | 沙漠公路 | art/background-autumn-desert-r91.webp |
| ocean | 海洋藝術館 | art/background-autumn-ocean-r91.webp |

四圖均為 1536×1024，使用內建 imagegen 生成，再以 WebP quality 88 / method 6 轉格式。後三個場景參考本次使用者提供的右側水彩美術。背景保留大片紙面，沒有地名貼紙、旅行編號或人物文字；介面標籤由既有 HTML 與翻譯流程顯示，生成圖不含功能資訊。它們是插畫，並非景點照片或現場紀錄。

素材只在選用風格／預覽或開啟該風格背景選單時載入；不加入 Service Worker 必要安裝清單。版本化 URL 沿用背景 cache-first，可重用已讀取的圖。單一 HTML 嵌入四圖，離線保留全部十種背景，因此檔案增加約 1.49 MB。

偏好 `uiPreferences.autumnBackground` 可為 cafe/fuji/desert/ocean，缺少或未知值預設 cafe。此可選欄位維持資料 KEY 與 Schema 15，舊備份仍可匯入；不改薪資、加班、請假或投資計算。

秋日紙面最低 alpha .93，其他模式 .96，並保留減少透明、高對比與列印規則。新風格沒有新增動畫迴圈或第三方字體。原有所有風格、HD-2D 五背景、晶羽飛行／魔法與 ornate 相容 ID 保留。

## 驗證範圍

純 Node VM production 函數／快取測試、JS 語法、CSS 解析、建置、單一 HTML 精確 CSP 雜湊與凍結檔案比對。素材本身已目視檢查；未使用瀏覽器、DOM 模擬器或私人資料。

手機與桌面的最終排版、水彩背景裁切、文字觀感與流暢度待實機驗證；程式 PASS 不是實機 FPS 或視覺驗收。
