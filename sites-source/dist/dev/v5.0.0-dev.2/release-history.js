/* Bundled release notes. Dates for earlier releases are Asia/Taipei dates
 * verified against the official desktop releases; no network request on open. */
(function(root){
 'use strict';
 const text=(zh,en)=>root.SalaryMateI18n?.language?.()==='en'?en:zh;
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const entries=[
  {version:'5.3.2',date:'2026-10-29',title:['漲跌數值與版本中心','Price changes and version center'],items:[
   ['股票／ETF 行情新增漲跌額，與最新價、漲跌幅並列；上漲、下跌、平盤皆有方向標示。','Stock and ETF quotes now show price change between the latest price and percentage change, with up, down and unchanged indicators.'],
   ['新增版本中心：查看目前版本、更新日期與各版重點；設定與側欄版本號都可開啟。','Added a version center showing the current version, release dates and changes, accessible from Settings and the sidebar version.'],
   ['沿用原始行情數值，缺少資料顯示「—」；既有薪資、投資與備份格式保持相容。','Uses source-provided changes and shows a dash when unavailable. Existing salary, investment and backup formats remain compatible.']
  ]},
  {version:'5.3.1',package:3,date:'2026-10-28',tag:'v5.3.1-desktop.3',title:['修正差異更新失敗','Fixed delta update failures'],items:[
   ['修正安裝版讀取差異更新檔案時的誤判，補上具體錯誤提示。','Fixed packaged-file reading during delta updates and added specific error messages.'],
   ['加入 Windows／Mac 封裝更新與還原測試。封裝 1／2 需更新一次完整安裝檔，後續相容版本可使用內容套件。','Added Windows and Mac packaged update and rollback tests. Packages 1/2 need one full installer upgrade; later compatible versions can use content packages.']
  ]},
  {version:'5.3.1',package:2,date:'2026-10-28',tag:'v5.3.1-desktop.2',title:['小圖示與星期六預設修正','Icons and Saturday defaults'],items:[
   ['選單、功能按鈕、設定及下拉選項加入小圖示，保留文字標示。','Added small icons to navigation, buttons, settings and select options while retaining text labels.'],
   ['星期六新增加班預設 8 小時，保留手動輸入時數與既有紀錄。','New Saturday overtime entries default to 8 hours; manual values and existing records are retained.']
  ]},
  {version:'5.3.1',package:1,date:'2026-10-24',tag:'v5.3.1-desktop.1',title:['更新與啟動穩定度','Update and startup stability'],items:[
   ['版本狀態成功存檔後才切換；重複操作依序處理，保留正確的上一版紀錄。','Version changes take effect only after saving succeeds; overlapping operations are serialized and the previous version is retained.'],
   ['無法保存還原狀態時，開啟可用版本並顯示提示，避免反覆重新啟動。','If recovery state cannot be saved, opens a working version with an explanation instead of repeatedly restarting.']
  ]},
  {version:'5.3.0',date:'2026-10-23',tag:'v5.3.0-desktop.1',title:['更新套件與失敗還原','Content updates and rollback'],items:[
   ['新增下載／匯入內容套件、備份後套用與還原上一版；每個檔案先經校驗。','Added content-package download and import, backup before applying, and rollback, with file verification.']
  ]},
  {version:'5.2.1',date:'2026-10-22',tag:'v5.2.1-desktop.1',title:['深色介面可讀性','Dark theme readability'],items:[
   ['修正深色、晚霧星紫與 HD-2D 介面的智慧分析卡片、文字與圖表對比。','Improved insight cards, text and chart contrast in Dark, Dusk Violet and HD-2D themes.']
  ]},
  {version:'5.2.0',date:'2026-10-22',tag:'v5.2.0-desktop.1',title:['原創圖示與智慧分析','Original icons and investment insights'],items:[
   ['加入股票、ETF 等原創圖示，以及依近期收盤價計算的趨勢、動能與風險觀察。','Added original stock and ETF icons, plus trend, momentum and risk observations based on recent closing prices.']
  ]},
  {version:'5.1.0',date:'2026-10-21',tag:'v5.1.0-desktop.1',title:['台股與美股盤中行情','Taiwan and US market quotes'],items:[
   ['交易時段每 60 秒查詢行情，顯示來源時間與即時／延遲狀態；收盤後補抓一次。','Queries quotes every 60 seconds during trading hours, displays source time and freshness, and checks once after the close.']
  ]}
 ];
 const versionLabel=e=>'v'+e.version+(e.package?' · '+text('桌面封裝 ','Desktop package ')+e.package:'');
 function render(version){
  const platform=root.SalaryMateDesktop?.platform;
  const channel=platform==='win32'?text('Windows 桌面版','Windows desktop'):platform==='darwin'?text('Mac 桌面版','Mac desktop'):root.Capacitor?.isNativePlatform?.()?text('Android 版','Android'):root.SalaryMatePortable||root.location?.protocol==='file:'?text('離線網頁版','Offline HTML'):text('網頁版','Web app');
  return `<section id="versionCenterPanel" class="version-center"><header class="version-center-current"><div><span class="version-center-eyebrow">${text('目前使用','Currently using')}</span><h2>SalaryMate <strong>v${esc(version)}</strong></h2><p>${channel}<span data-version-desktop></span></p></div><span class="version-center-badge">${text('正式版','Stable')}</span></header><p class="hint">${text('查看這個版本新增了什麼，以及近期的修正紀錄。','See what is new in this version and review recent fixes.')}</p><div class="version-center-history">${entries.map((e,i)=>`<details class="version-center-release" ${i===0?'open':''}><summary><span><strong>${esc(versionLabel(e))}</strong><span class="version-center-release-title">${text(...e.title)}</span></span><time datetime="${e.date}">${e.date.replaceAll('-','/')}</time></summary><ul>${e.items.map(item=>`<li>${text(...item)}</li>`).join('')}</ul>${e.tag?`<a class="version-center-source" href="https://github.com/sparcgx/SalaryMate/releases/tag/${e.tag}" target="_blank" rel="noopener noreferrer">${text('查看這版發行說明','View this release')}</a>`:''}</details>`).join('')}</div><p class="hint">${text('歷史日期依桌面正式發行紀錄（台北時間）；網站與各平台可能分批更新。','Earlier dates follow official desktop releases in Taipei time; the website and platforms may be updated separately.')}</p><div class="form-actions">${platform?`<button type="button" class="btn btn-primary" data-action="open-desktop-updates">${text('桌面更新中心','Desktop update center')}</button>`:''}<a class="btn" href="https://github.com/sparcgx/SalaryMate/releases" target="_blank" rel="noopener noreferrer">${text('所有桌面發行紀錄','All desktop releases')}</a><button type="button" class="btn" data-action="close-dialog">${text('關閉','Close')}</button></div></section>`;
 }
 root.SalaryMateReleaseHistory=Object.freeze({version:'5.3.2',render,entries});
})(globalThis);
