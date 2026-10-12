/* Android-only adapters for the existing R99 app. Bundled after Capacitor's
 * injected bridge and before startup.js; website source and storage stay intact. */
(function(root){
 'use strict';
 const cap=root.Capacitor;
 if(!cap?.isNativePlatform?.()||cap.getPlatform?.()!=='android'||(root.top&&root.top!==root))return;
 const MAX_BYTES=45*1024*1024;
 root.SalaryMatePortable=Object.freeze({marketOrigin:'https://salarymate.sparcgx2420.chatgpt.site'});
 const blobs=new Map();
 let documentBusy=false,pendingExports=0,pageGeneration=0;
 root.addEventListener('pagehide',()=>pageGeneration++);
 const text=(zh,en)=>root.SalaryMateI18n?.language?.()==='en'?en:zh;
 const messageFor=error=>({
  SAVE_CANCELLED:text('已取消儲存；本機資料保持不變。','Save cancelled; local data is unchanged.'),
  OPEN_CANCELLED:text('已取消選擇備份；本機資料保持不變。','File selection cancelled; local data is unchanged.'),
  DOCUMENT_BUSY:text('請等目前檔案操作完成。','Wait for the current file operation to finish.'),
  BRIDGE_UNAVAILABLE:text('Android 檔案服務尚未就緒。請重新開啟 App 後重試；本機資料保持不變。','The Android file service is unavailable. Reopen the app and try again; local data is unchanged.'),
  PICKER_UNAVAILABLE:text('此裝置沒有可用的檔案選擇器。','No document picker is available on this device.'),
  SAVE_INVALID_DOCUMENT:text('檔案內容、格式或大小不正確；上限 45 MB。','Invalid file content, format or size; the limit is 45 MB.'),
  SAVE_EXTENSION_CHANGED:text('儲存位置未保留原副檔名，已停止儲存。','The destination changed the file extension; saving was stopped.'),
  SAVE_FAILED:text('檔案未能完整寫入或讀回驗證；請重新選擇儲存位置。','The file could not be written and verified; choose another save location.'),
  OPEN_FAILED:text('備份無法讀取、編碼不正確或超過 45 MB；現有資料保持不變。','Backup unreadable, invalid encoding or over 45 MB; existing data is unchanged.'),
  OPEN_INVALID_DOCUMENT:text('請選擇 JSON 或 SalaryMate 備份檔。','Choose a JSON or SalaryMate backup file.')
 }[error?.code]||error?.message||text('檔案操作失敗；本機資料保持不變。','File operation failed; local data is unchanged.'));
 const notice=(message,error=false)=>{
  const toast=root.document.getElementById('toast');
  if(!toast)return;
  toast.textContent=message;toast.className='toast show '+(error?'error':'info');
  toast.setAttribute('role',error?'alert':'status');
 };
 const checkedSize=size=>{if(!Number.isSafeInteger(size)||size<1||size>MAX_BYTES)throw new Error(text('檔案為空或超過 45 MB。','File is empty or exceeds 45 MB.'));};
 // Count UTF-8 bytes without allocating another full backup-sized buffer.
 const checkedTextSize=data=>{
  if(typeof data!=='string')throw new Error(messageFor({code:'OPEN_FAILED'}));
  checkedSize(data.length);let size=0;
  for(let i=0;i<data.length;i++){
   const code=data.charCodeAt(i);
   if(code<0x80)size++;else if(code<0x800)size+=2;
   else if(code>=0xd800&&code<=0xdbff&&i+1<data.length&&data.charCodeAt(i+1)>=0xdc00&&data.charCodeAt(i+1)<=0xdfff){size+=4;i++;}
   else size+=3;
   if(size>MAX_BYTES)checkedSize(size);
  }
  return size;
 };
 const base64=bytes=>{
  // Multiples of three preserve base64 boundaries without a full binary string.
  const chunks=[];for(let offset=0;offset<bytes.length;offset+=24576)chunks.push(root.btoa(String.fromCharCode(...bytes.subarray(offset,offset+24576))));
  return chunks.join('');
 };
 const operationError=code=>Object.assign(new Error(messageFor({code})),{code});
 async function documentOperation(method,run,exporting=false){
  if(documentBusy)throw operationError('DOCUMENT_BUSY');
  // Capacitor's injected Android bridge exports native proxies under Plugins.
  // Resolve on every attempt so an unavailable bridge can fail visibly/retry.
  const files=cap.Plugins?.BackupFile;
  if(typeof files?.[method]!=='function')throw operationError('BRIDGE_UNAVAILABLE');
  documentBusy=true;if(exporting)pendingExports++;
  try{return await run(options=>files[method](options));}
  finally{documentBusy=false;if(exporting)pendingExports--;}
 }
 async function saveVerified(save,options,size){
  const result=await save(options);
  if(result?.verified!==true||result.size!==size||typeof result.fileName!=='string'||!result.fileName)throw new Error(text('檔案尚未通過寫入驗證。','The saved file has not passed read-back verification.'));
  return result;
 }
 async function saveBlob(blob,fileName){
  checkedSize(blob.size);
  return documentOperation('saveDocument',async save=>{
   const bytes=new Uint8Array(await blob.arrayBuffer());checkedSize(bytes.byteLength);
   const mimeType=(blob.type||'application/octet-stream').split(';')[0].toLowerCase();
   return saveVerified(save,{data:base64(bytes),fileName,mimeType,encoding:'base64'},bytes.byteLength);
  },true);
 }
 const originalCreate=root.URL.createObjectURL.bind(root.URL),originalRevoke=root.URL.revokeObjectURL.bind(root.URL);
 root.URL.createObjectURL=function(value){const url=originalCreate(value);if(value instanceof root.Blob)blobs.set(url,value);return url;};
 root.URL.revokeObjectURL=function(url){blobs.delete(String(url));return originalRevoke(url);};
 root.document.addEventListener('click',event=>{
  const anchor=event.target.closest?.('a[download]');
  if(!anchor||!anchor.href?.startsWith('blob:'))return;
  event.preventDefault();event.stopImmediatePropagation();
  // Hold the actual Blob while the original helper revokes its URL after one
  // second. Never depend on the user finishing the picker before that timeout.
  const blob=blobs.get(anchor.href),name=anchor.download;
  pendingExports++;
  Promise.resolve().then(async()=>{
   const source=blob||await (await root.fetch(anchor.href)).blob();
   notice(text('請選擇儲存位置；完成後會讀回驗證檔案。','Choose a save location; the file will then be read back and verified.'));
   const result=await saveBlob(source,name);
   notice(text('檔案已完整儲存並驗證：','File saved and verified: ')+result.fileName);
  }).catch(error=>notice(messageFor(error),!String(error?.code||'').endsWith('CANCELLED'))).finally(()=>pendingExports--);
 },true);
 // Existing web report helpers announce a download synchronously. During the
 // native picker keep those specific messages pending until verified saving.
 root.document.addEventListener('DOMContentLoaded',()=>{
  const toast=root.document.getElementById('toast');if(!toast||!root.MutationObserver)return;
  new root.MutationObserver(()=>{
   if(pendingExports&&/^(?:已匯出|已下載列印版|加密備份已匯出|完整 JSON 備份已匯出|Exported\b|Downloaded\b|Encrypted backup exported|Complete JSON backup exported|Printable version downloaded|Annual report for the current scope exported)/.test(toast.textContent))
    notice(text('請選擇儲存位置；完成後會讀回驗證檔案。','Choose a save location; the file will then be read back and verified.'));
  }).observe(toast,{childList:true,subtree:true,characterData:true});
 },{once:true});

 // The encrypted-backup form must await native verification instead of its
 // browser-only immediate success path. Passwords remain in the local form.
 root.document.addEventListener('submit',event=>{
  const form=event.target;if(form?.id!=='backupExportForm')return;
  event.preventDefault();event.stopImmediatePropagation();
  if(form.dataset.busy||!form.reportValidity())return;
  const encrypted=form.elements.encrypted.checked,status=form.querySelector('.backup-status'),button=form.querySelector('[type="submit"]'),generation=pageGeneration;
  const active=()=>generation===pageGeneration&&form.isConnected&&root.document.getElementById('appDialog')?.open;
  if(encrypted&&form.elements.password.value!==form.elements.confirmation.value){status.textContent=text('兩次密碼不一致，請重新確認。','Passwords do not match.');return;}
  form.dataset.busy='true';button.disabled=true;
  status.textContent=text('正在準備備份；請選擇儲存位置。','Preparing backup; choose a save location.');
  Promise.resolve().then(()=>documentOperation('saveDocument',async save=>{
   if(!active())return;
   let payload=JSON.parse(root.SalaryMateData.exportPayload());
   const version=payload.exportInfo?.appVersion||'5';
   if(encrypted)payload=await root.SalaryMateBackup.encrypt(payload,form.elements.password.value);
   if(!active())return;
   const data=JSON.stringify(payload,null,2),size=checkedTextSize(data);
   const result=await saveVerified(save,{data,fileName:'SalaryMate_'+String(version||'5').replace(/[^A-Za-z0-9.-]/g,'')+'_'+(encrypted?'encrypted':'backup')+'_'+new Date().toISOString().slice(0,10)+'.json',mimeType:'application/json',encoding:'utf8'},size);
   if(active()){status.textContent=text('備份已完整儲存並驗證：','Backup saved and verified: ')+result.fileName;form.elements.password.value='';form.elements.confirmation.value='';}
  },true)).catch(error=>{if(active())status.textContent=messageFor(error);}).finally(()=>{delete form.dataset.busy;button.disabled=false;});
 },true);

 function createDriveUI(api){
  const summary=()=>text('手動備份至 Drive 或本機；Drive 需安裝並登入，不會自動同步。','Manually back up to Drive or local storage. Drive must be installed and signed in; no automatic sync.');
  let busy=false,panelSerial=0;
  function open(){
   panelSerial++;
   api.openDialog(text('自己的 Google Drive','Your Google Drive'),`<section id="androidDrivePanel"><p>${text('此 Android 版使用系統檔案選擇器。設備已安裝並登入 Google Drive 時，可在位置清單選擇自己的 Drive；若清單沒有 Drive，請先安裝或改選本機位置。','This Android app uses the system document picker. If Google Drive is installed and signed in, choose your own Drive in the location list. If Drive is unavailable, install it or choose local storage.')}</p><p class="hint">${text('App 與瀏覽器資料各自保存。選擇備份後會先驗證與預覽，不會自動取代本機資料。','App and browser data are stored separately. Selected backups are validated and previewed before any local data is replaced.')}</p><p class="hint">${text('此入口不使用內嵌 Google 登入，也沒有網站版的 API 清單或自動同步。','This entry does not use embedded Google sign-in and does not provide the website API file list or automatic synchronization.')}</p><div class="form-actions"><button class="btn btn-primary" type="button" data-android-drive="save">${text('儲存一份','Save a backup')}</button><button class="btn" type="button" data-android-drive="open">${text('選擇備份','Choose backup')}</button><button class="btn" type="button" data-action="export-json">${text('加密備份','Encrypted backup')}</button><button class="btn" type="button" data-action="close-dialog">${text('返回','Back')}</button></div><p class="drive-status" role="status" data-android-drive-status></p></section>`,true);
  }
  root.document.addEventListener('click',event=>{
   const button=event.target.closest?.('[data-android-drive]');if(!button)return;
   event.preventDefault();event.stopImmediatePropagation();
   const panel=button.closest('#androidDrivePanel'),status=panel?.querySelector('[data-android-drive-status]');
   if(!panel||!status)return;
   const serial=panelSerial,generation=pageGeneration;
   const active=()=>serial===panelSerial&&generation===pageGeneration&&panel.isConnected&&root.document.getElementById('appDialog')?.open;
   const show=value=>{if(active())status.textContent=value;};
   if(!active())return;
   if(button.disabled||busy){show(messageFor({code:'DOCUMENT_BUSY'}));return;}
   busy=true;panel.querySelectorAll('[data-android-drive]').forEach(node=>node.disabled=true);
   show(text('請在系統檔案選擇器選擇自己的 Drive 或本機位置。','Choose your own Drive or local storage in the system document picker.'));
   Promise.resolve().then(async()=>{
    if(!active())return;
    if(button.dataset.androidDrive==='save'){
     const result=await documentOperation('saveDocument',save=>{
      const data=root.SalaryMateData.exportPayload(),size=checkedTextSize(data);
      return saveVerified(save,{data,fileName:'SalaryMate_backup_'+new Date().toISOString().slice(0,10)+'.json',mimeType:'application/json',encoding:'utf8'},size);
     },true);
     show(text('備份已完整儲存並驗證：','Backup saved and verified: ')+result.fileName);
    }else{
     const result=await documentOperation('openDocument',open=>open());
     if(!active())return;
     checkedSize(result?.size);if(checkedTextSize(result.data)!==result.size)throw operationError('OPEN_FAILED');
     api.closeDialog();await root.SalaryMateData.importPayload(result.data);
    }
   }).catch(error=>{show(messageFor(error));}).finally(()=>{busy=false;if(panel.isConnected)panel.querySelectorAll('[data-android-drive]').forEach(node=>node.disabled=false);});
  },true);
  return Object.freeze({open,summary,changed(){},stopAuto(){}});
 }
 // Intercept only this Android bundle's adapter factory assignment. Do not load
 // GIS or connect an OAuth client in a controlled embedded browser.
 let driveUI=Object.freeze({create:createDriveUI});
 Object.defineProperty(root,'SalaryMateGoogleDriveUI',{
  configurable:true,enumerable:true,get:()=>driveUI,
  set(value){driveUI=Object.freeze({...value,create:createDriveUI});}
 });
 root.SalaryMateAndroid=Object.freeze({saveBlob,createDriveUI,maxDocumentBytes:MAX_BYTES});
})(globalThis);
