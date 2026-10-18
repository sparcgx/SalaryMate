'use strict';
const {app, BrowserWindow, Menu, dialog, ipcMain, net, protocol, session, shell} = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {APP_URL, documentURL, safeAsset, publicApiPath} = require('./security.cjs');
const {createFileService} = require('./files.cjs');
app.setName('SalaryMate');
// Version-independent identity: upgrades reuse this profile. Never clear storage.
app.setPath('userData', path.join(app.getPath('appData'), 'SalaryMate'));
protocol.registerSchemesAsPrivileged([{scheme: 'salarymate', privileges: {standard: true, secure: true, supportFetchAPI: true, corsEnabled: true}}]);
app.enableSandbox();
const singleInstance = app.requestSingleInstanceLock();
let window;
if (!singleInstance) app.quit();
else {
  app.on('second-instance', () => {if (window) {if (window.isMinimized()) window.restore(); window.show(); window.focus();}});
  app.whenReady().then(start).catch(() => {dialog.showErrorBox('SalaryMate', '無法啟動程式，請重新安裝完整套件。本機資料保持不變。\nUnable to start. Reinstall the complete package; local data is retained.'); app.quit();});
}
async function start() {
  const assets = path.join(app.getAppPath(), 'www');
  const manifest = JSON.parse(fs.readFileSync(path.join(assets, 'desktop-asset-manifest.json'), 'utf8'));
  const files = Object.fromEntries(manifest.files.map(file => [file.path, file]));
  const [{createStockMarket}, {createReferenceApi}] = await Promise.all([
    import(pathToFileURL(path.join(app.getAppPath(), 'api/stock-market.mjs')).href),
    import(pathToFileURL(path.join(app.getAppPath(), 'api/reference-api.mjs')).href)
  ]);
  // Same validated public-data handlers as the website, executed on this device.
  // No listening port, private-state API, generic URL proxy or remote app code.
  const market = createStockMarket(), reference = createReferenceApi();
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
        return await (isFx ? reference(localRequest) : market(localRequest));
      }
      const key = safeAsset(request.url, files);
      if (!key || !['GET','HEAD'].includes(request.method)) return new Response('Not found', {status: 404});
      const response = await net.fetch(pathToFileURL(path.join(assets, key)).href);
      const headers = new Headers(response.headers);
      headers.set('Content-Security-Policy', manifest.csp);
      headers.set('X-Content-Type-Options', 'nosniff');
      headers.set('Cache-Control', 'no-cache');
      return new Response(request.method === 'HEAD' ? null : response.body, {status: response.status, headers});
    } catch { return new Response('服務暫時無法使用 / Service unavailable', {status: 503}); }
  });
  const service = createFileService({dialog, parent: () => window});
  for (const [channel, action] of [['salarymate:save', input => service.save(input)], ['salarymate:open', () => service.open()]]) {
    ipcMain.handle(channel, (event, input) => {
      if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame || !documentURL(event.senderFrame.url)) return {ok:false,code:'BRIDGE_UNAVAILABLE'};
      return action(input);
    });
  }
  async function external(value) {
    let url; try {url = new URL(value);} catch {return;}
    if (url.protocol !== 'https:' || url.username || url.password || value.length > 2048) return;
    const answer = await dialog.showMessageBox(window, {type:'question', buttons:['取消 / Cancel','開啟 / Open'], defaultId:0, cancelId:0, message:'在預設瀏覽器開啟連結？ / Open in your browser?', detail:url.href});
    if (answer.response === 1) await shell.openExternal(url.href).catch(() => {});
  }
  function createWindow() {
    window = new BrowserWindow({width:1280,height:850,minWidth:480,minHeight:640,show:false,backgroundColor:'#f4f7fb',title:'SalaryMate v5.0.0 正式版',icon:path.join(assets,'icons/icon-512.png'),webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true,webviewTag:false,allowRunningInsecureContent:false}});
    window.webContents.setWindowOpenHandler(({url}) => {void external(url); return {action:'deny'};});
    window.webContents.on('will-navigate', (event,url) => {if (!documentURL(url)) {event.preventDefault(); void external(url);}});
    window.webContents.on('will-redirect', (event,url) => {if (!documentURL(url)) event.preventDefault();});
    window.webContents.on('will-attach-webview', event => event.preventDefault());
    window.webContents.on('will-prevent-unload', event => {
      const answer = dialog.showMessageBoxSync(window, {type:'question',buttons:['繼續編輯 / Keep editing','離開 / Leave'],defaultId:0,cancelId:0,message:'仍有編輯中的內容，要離開嗎？ / Leave with unsaved changes?'});
      if (answer === 1) event.preventDefault();
    });
    window.on('close', event => {if (service.isBusy()) {event.preventDefault(); void dialog.showMessageBox(window,{message:'請等待檔案操作完成，或先取消選擇器。 / Finish or cancel the file operation first.'});}});
    window.on('closed', () => {window = null;});
    window.once('ready-to-show', () => window?.show());
    window.webContents.once('did-fail-load', () => {window?.show();dialog.showErrorBox('SalaryMate','畫面載入失敗，請重新開啟程式。本機資料保持不變。 / Unable to load; reopen the app. Local data is retained.');});
    void window.loadURL(APP_URL);
  }
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(process.platform === 'darwin' ? [{role:'appMenu'}] : [{label:'SalaryMate',submenu:[{role:'quit'}]}]),
    {role:'editMenu'},
    {label:'檢視 / View',submenu:[{role:'resetZoom'},{role:'zoomIn'},{role:'zoomOut'},{type:'separator'},{role:'togglefullscreen'}]},
    {role:'windowMenu'},
    {label:'說明 / Help',submenu:[{label:'關於 SalaryMate / About',click:() => dialog.showMessageBox(window,{message:'SalaryMate v5.0.0 正式版',detail:'桌面封裝 2 · 本機離線資料\nDesktop package 2 · Local offline data\n資料與網站分開儲存；以備份匯入搬移。\nTransfer browser records with a backup.\n未具發行者簽章／Apple 公證。\nNo publisher certificate or Apple notarization.'})}]}
  ]));
  createWindow();
  app.on('activate', () => {if (!window) createWindow();});
  app.on('before-quit', () => session.defaultSession.flushStorageData());
}
app.on('window-all-closed', () => {if (process.platform !== 'darwin') app.quit();});
