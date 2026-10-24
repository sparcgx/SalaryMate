'use strict';
const {app, BrowserWindow, Menu, dialog, ipcMain, net, protocol, session, shell, globalShortcut, Tray, nativeImage} = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const {APP_URL, documentURL, publicApiPath} = require('./security.cjs');
const {createFileService} = require('./files.cjs');
const {createPublicApis} = require('./public-api.cjs');
const {createAssetResponder} = require('./assets.cjs');
const {createBackupService,checkedOptions} = require('./backups.cjs');
const {createQuickEntry} = require('./quick-entry.cjs');
const {createPdfService,renderPdf} = require('./pdf.cjs');
const {createUpdateService}=require('./updates.cjs');
const {createContentService}=require('./content-updates.cjs');
app.setName('SalaryMate');
// Version-independent identity: upgrades reuse this profile. Never clear storage.
app.setPath('userData', path.join(app.getPath('appData'), 'SalaryMate'));
protocol.registerSchemesAsPrivileged([{scheme: 'salarymate', privileges: {standard: true, secure: true, supportFetchAPI: true, corsEnabled: true}}]);
app.enableSandbox();
const singleInstance = app.requestSingleInstanceLock();
let window,quitting=false;
if (!singleInstance) app.quit();
else {
  app.on('second-instance', () => {if (window) {if (window.isMinimized()) window.restore(); window.show(); window.focus();}});
  app.whenReady().then(start).catch(() => {dialog.showErrorBox('SalaryMate', '無法啟動程式，請重新安裝完整套件。本機資料保持不變。\nUnable to start. Reinstall the complete package; local data is retained.'); app.quit();});
}
async function start() {
  const baseDirectory=app.getAppPath();
  const runtime=JSON.parse(await fs.readFile(path.join(baseDirectory,'content-manifest.json'),'utf8'));
  const contentService=createContentService({userData:app.getPath('userData'),baseDirectory,runtimeId:runtime.runtimeId});
  const content=await contentService.start();
  const assets = path.join(content.directory, 'www');
  const manifest = JSON.parse(await fs.readFile(path.join(assets, 'desktop-asset-manifest.json'), 'utf8'));
  const contentVersion=manifest.version;
  const relaunch=()=>{quitting=true;session.defaultSession.flushStorageData();app.relaunch();app.quit();};
  let startupTimer;
  // Same validated public-data handlers as the website, executed on this device.
  // No listening port, private-state API, generic URL proxy or remote app code.
  const apiHandlers = createPublicApis(content.directory);
  const serveAsset = createAssetResponder({directory:assets, manifest, fetchFile:url => net.fetch(url)});
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  session.defaultSession.setPermissionCheckHandler(() => false);
  protocol.handle('salarymate', async request => {
    try {
      const api = publicApiPath(request.url);
      if (api) {
        if (request.initiatorOrigin && request.initiatorOrigin !== 'salarymate://app') return new Response('Forbidden', {status: 403});
        const url = new URL(request.url), isFx = url.pathname === '/api/reference/fx';
        if (request.method !== (isFx ? 'GET' : 'POST')) return new Response('Method not allowed', {status: 405});
        const options = {method: request.method, signal: request.signal, headers: {'content-type':'application/json'}};
        // Request has a bounded stream; the retained stock handler limits it to 16KB.
        if (!isFx) {options.body = request.body; options.duplex = 'half';}
        const localRequest = new Request('https://salarymate.desktop' + api, options);
        return await (isFx ? apiHandlers.reference(localRequest) : apiHandlers.stock(localRequest));
      }
      return await serveAsset(request);
    } catch { return new Response('服務暫時無法使用 / Service unavailable', {status: 503}); }
  });
  const service = createFileService({dialog, parent: () => window});
  const backups=createBackupService({userData:app.getPath('userData'),chooseDirectory:async()=>{
    const result=await dialog.showOpenDialog(window,{title:'選擇自動備份資料夾 / Choose automatic backup folder',properties:['openDirectory','createDirectory']});
    return result.canceled?null:result.filePaths?.[0];
  }});
  const pdf=createPdfService({dialog,parent:()=>window,render:input=>renderPdf(input,{BrowserWindow,session})});
  const updates=createUpdateService({userData:app.getPath('userData'),currentTag:content.manifest.tag,build:manifest.desktopBuild,platform:process.platform,arch:process.arch,dialog,parent:()=>window,contentService,relaunch,
    notify:state=>{if(window&&!window.isDestroyed())window.webContents.send('salarymate:update-state',state);},
    saveBackup:input=>service.save(input),openPath:file=>shell.openPath(file),showItemInFolder:file=>shell.showItemInFolder(file),quit:()=>app.quit()});
  let featureBusy=false,pendingAction=null,shortcutProblem='';
  const desktopActions=new Set(['quick','record','overtime','leave','transaction','backups','options','pdf','updates']);
  function sendDesktopAction(action){
    if(!desktopActions.has(action))return;
    if(!window)createWindow();
    if(window.isMinimized())window.restore();window.show();window.focus();
    if(window.webContents.isLoadingMainFrame())pendingAction=action;
    else window.webContents.send('salarymate:desktop-action',action);
  }
  const quick=createQuickEntry({globalShortcut,send:sendDesktopAction,makeTray:()=>{
    const icon=nativeImage.createFromPath(path.join(assets,'icons/icon-192.png')).resize({width:process.platform==='darwin'?18:20,height:process.platform==='darwin'?18:20});
    const tray=new Tray(icon);tray.setToolTip('SalaryMate v'+contentVersion);
    tray.setContextMenu(Menu.buildFromTemplate([
      {label:'快捷登記 / Quick entry',click:()=>sendDesktopAction('quick')},
      {label:'記加班 / Overtime',click:()=>sendDesktopAction('overtime')},
      {label:'記請假 / Leave',click:()=>sendDesktopAction('leave')},
      {label:'股票交易 / Stock transaction',click:()=>sendDesktopAction('transaction')},
      {type:'separator'},{label:'備份歷史 / Backups',click:()=>sendDesktopAction('backups')},
      {label:'更新中心 / Update center',click:()=>sendDesktopAction('updates')},
      {label:'顯示 SalaryMate / Show',click:()=>{window?.show();window?.focus();}},
      {label:'結束 / Quit',click:()=>app.quit()}
    ]));tray.on('click',()=>sendDesktopAction('quick'));return tray;
  }});
  const featureHandlers={
    'features-state':async()=>({options:await backups.options(),shortcutActive:quick.enabled(),shortcutProblem}),
    'backup-directory':async()=>({options:await backups.choose()}),
    'features-configure':async input=>{
      checkedOptions(input);const before=await backups.options();
      if(input.enabled&&!before.directory)throw Object.assign(Error('BACKUP_NOT_CONFIGURED'),{code:'BACKUP_NOT_CONFIGURED'});
      quick.configure(input);
      try{const options=await backups.setOptions(input);shortcutProblem='';return {options,shortcutActive:quick.enabled()};}
      catch(error){quick.configure(before);throw error;}
    },
    'backup-snapshot':input=>backups.save(input),
    'backup-history':async()=>({entries:await backups.list()}),
    'backup-read':id=>backups.read(id),
    'report-pdf':input=>pdf.save(input),
    'updates-check':()=>updates.check(),
    'updates-download':()=>updates.download(),
    'updates-import':()=>updates.importPackage(),
    'updates-rollback':data=>updates.rollback(data),
    'updates-reveal':()=>updates.reveal(),
    'updates-install':data=>updates.install(data)
  };
  for(const [name,action] of Object.entries(featureHandlers))ipcMain.handle('salarymate:'+name,async(event,input)=>{
    if(!window||event.sender!==window.webContents||event.senderFrame!==window.webContents.mainFrame||!documentURL(event.senderFrame.url))return {ok:false,code:'BRIDGE_UNAVAILABLE'};
    if(featureBusy||service.isBusy())return {ok:false,code:'DESKTOP_BUSY'};
    featureBusy=true;
    try{return {ok:true,...await action(input)};}
    catch(error){const allowed=new Set(['INVALID_OPTIONS','SHORTCUT_UNAVAILABLE','PREFERENCES_UNREADABLE','BACKUP_NOT_CONFIGURED','BACKUP_UNREADABLE','BACKUP_INTEGRITY','HISTORY_UNREADABLE','INVALID_BACKUP','INVALID_REPORT','DESKTOP_BUSY','OPEN_CANCELLED','SAVE_CANCELLED','SAVE_EXTENSION_CHANGED','PDF_TIMEOUT','UPDATE_INVALID','UPDATE_TIMEOUT','UPDATE_CANCELLED','UPDATE_RATE_LIMIT','UPDATE_UNAVAILABLE','UPDATE_CHECK_REQUIRED','UPDATE_EXTENSION','UPDATE_DOWNLOAD_FAILED','UPDATE_INTEGRITY','UPDATE_NOT_DOWNLOADED','UPDATE_BACKUP_FAILED','UPDATE_OPEN_FAILED','UPDATE_PACKAGE_INVALID','UPDATE_PACKAGE_INCOMPATIBLE','UPDATE_NO_ROLLBACK','UPDATE_STATE_WRITE']);return {ok:false,code:allowed.has(error.code)?error.code:name.startsWith('updates-')?'UPDATE_NETWORK':'DESKTOP_FAILED'};}
    finally{featureBusy=false;}
  });
  // State and cancellation remain available while a download owns the file lock.
  for(const [name,action] of [['updates-state',()=>updates.state()],['updates-cancel',()=>updates.cancel()],['content-ready',async()=>{await contentService.ready();clearTimeout(startupTimer);return {ready:true};}]])ipcMain.handle('salarymate:'+name,async event=>{
    if(!window||event.sender!==window.webContents||event.senderFrame!==window.webContents.mainFrame||!documentURL(event.senderFrame.url))return {ok:false,code:'BRIDGE_UNAVAILABLE'};
    try{return {ok:true,...await action()};}catch(error){return {ok:false,code:error.code==='UPDATE_STATE_WRITE'?'UPDATE_STATE_WRITE':'UPDATE_NETWORK'};}
  });
  for (const [channel, action] of [['salarymate:save', input => service.save(input)], ['salarymate:open', () => service.open()]]) {
    ipcMain.handle(channel, (event, input) => {
      if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame || !documentURL(event.senderFrame.url)) return {ok:false,code:'BRIDGE_UNAVAILABLE'};
      return featureBusy?{ok:false,code:'DOCUMENT_BUSY'}:action(input);
    });
  }
  async function external(value) {
    let url; try {url = new URL(value);} catch {return;}
    if (url.protocol !== 'https:' || url.username || url.password || value.length > 2048) return;
    const answer = await dialog.showMessageBox(window, {type:'question', buttons:['取消 / Cancel','開啟 / Open'], defaultId:0, cancelId:0, message:'在預設瀏覽器開啟連結？ / Open in your browser?', detail:url.href});
    if (answer.response === 1) await shell.openExternal(url.href).catch(() => {});
  }
  function createWindow() {
    window = new BrowserWindow({width:1280,height:850,minWidth:480,minHeight:640,show:false,backgroundColor:'#f4f7fb',title:'SalaryMate v'+contentVersion+' 正式版',icon:path.join(assets,'icons/icon-512.png'),webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,webviewTag:false,allowRunningInsecureContent:false}});
    window.webContents.setWindowOpenHandler(({url}) => {void external(url); return {action:'deny'};});
    window.webContents.on('will-navigate', (event,url) => {if (!documentURL(url)) {event.preventDefault(); void external(url);}});
    window.webContents.on('will-redirect', (event,url) => {if (!documentURL(url)) event.preventDefault();});
    window.webContents.on('will-attach-webview', event => event.preventDefault());
    window.webContents.on('will-prevent-unload', event => {
      const answer = dialog.showMessageBoxSync(window, {type:'question',buttons:['繼續編輯 / Keep editing','離開 / Leave'],defaultId:0,cancelId:0,message:'仍有編輯中的內容，要離開嗎？ / Leave with unsaved changes?'});
      if (answer === 1) event.preventDefault();
    });
    window.on('close', event => {
      if(service.isBusy()||featureBusy){event.preventDefault();void dialog.showMessageBox(window,{message:'請等待檔案操作完成，或先取消選擇器。 / Finish or cancel the file operation first.'});return;}
      if(quick.enabled()&&!quitting){event.preventDefault();window.hide();}
    });
    window.on('closed', () => {window = null;});
    window.once('ready-to-show', () => window?.show());
    window.webContents.on('did-finish-load',()=>{if(pendingAction){window?.webContents.send('salarymate:desktop-action',pendingAction);pendingAction=null;}});
    window.webContents.once('did-fail-load', () => {window?.show();dialog.showErrorBox('SalaryMate','畫面載入失敗，請重新開啟程式。本機資料保持不變。 / Unable to load; reopen the app. Local data is retained.');});
    void window.loadURL(APP_URL).catch(()=>{}); // did-fail-load and the trial watchdog handle recovery.
    if(contentService.status().pending){clearTimeout(startupTimer);startupTimer=setTimeout(()=>{if(contentService.status().pending)relaunch();},45000);}
  }
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(process.platform === 'darwin' ? [{role:'appMenu'}] : [{label:'SalaryMate',submenu:[{role:'quit'}]}]),
    {role:'editMenu'},
    {label:'檢視 / View',submenu:[{role:'resetZoom'},{role:'zoomIn'},{role:'zoomOut'},{type:'separator'},{role:'togglefullscreen'}]},
    {role:'windowMenu'},
    {label:'桌面工具 / Desktop',submenu:[{label:'快捷登記 / Quick entry',click:()=>sendDesktopAction('quick')},{label:'自動備份 / Automatic backups',click:()=>sendDesktopAction('backups')},{label:'年度報表 PDF / Annual PDF',click:()=>sendDesktopAction('pdf')},{label:'快捷鍵設定 / Shortcut settings',click:()=>sendDesktopAction('options')},{label:'更新中心 / Update center',click:()=>sendDesktopAction('updates')}]},
    {label:'說明 / Help',submenu:[{label:'更新中心 / Update center',click:()=>sendDesktopAction('updates')},{label:'關於 SalaryMate / About',click:() => dialog.showMessageBox(window,{message:'SalaryMate v'+contentVersion+' 正式版',detail:'主系統 / Runtime v'+app.getVersion()+'\n更新套件支援 / Content packages supported\n資料與網站分開儲存；以備份匯入搬移。\nTransfer browser records with a backup.\n未具發行者簽章／Apple 公證。\nNo publisher certificate or Apple notarization.'})}]}
  ]));
  createWindow();
  // Preferences and shortcut registration never block the first window.
  void backups.options().then(options=>quick.configure(options)).catch(error=>{shortcutProblem=error.code||'DESKTOP_FAILED';});
  app.on('activate', () => {if (!window) createWindow();});
  app.on('before-quit', event => {
    if(service.isBusy()||featureBusy){event.preventDefault();quitting=false;window?.show();void dialog.showMessageBox(window,{message:'檔案正在處理，完成後請再結束。 / A file operation is running. Quit after it finishes.'});return;}
    quitting=true;session.defaultSession.flushStorageData();
  });
  app.on('will-quit',()=>{clearTimeout(startupTimer);quick.dispose();});
}
app.on('window-all-closed', () => {if (process.platform !== 'darwin') app.quit();});
