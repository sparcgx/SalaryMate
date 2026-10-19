/* Desktop-only controls. Data edits still use the existing validated app forms. */
(function(root){
 'use strict';
 const bridge=root.SalaryMateDesktop;if(!bridge)return;
 const text=(zh,en)=>root.SalaryMateI18n?.language?.()==='en'?en:zh;
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let api,options,timer,busy=false,pendingAction=null,revision=1,savedRevision=0,lastError='',lastEntry=null;
 const labels={
  SHORTCUT_UNAVAILABLE:['快捷鍵已被其他程式使用，請改選另一組。','Shortcut is in use. Choose another combination.'],
  BACKUP_NOT_CONFIGURED:['請先選擇備份資料夾。','Choose a backup folder first.'],
  BACKUP_INTEGRITY:['備份內容與校驗碼不符，未匯入資料。','Backup integrity check failed. Nothing was imported.'],
  BACKUP_UNREADABLE:['備份資料夾或檔案無法讀取，請確認磁碟與同步資料夾。','Backup folder or file is unavailable. Check the drive or sync folder.'],
  HISTORY_UNREADABLE:['備份歷史無法驗證，已停止寫入與清理。請保留資料夾後另選位置。','Backup history cannot be verified. Writing and cleanup stopped. Preserve this folder and choose another.'],
  PREFERENCES_UNREADABLE:['桌面設定無法讀取。現有薪資與投資資料保持不變。','Desktop settings cannot be read. Existing salary and investment data is unchanged.'],
  DESKTOP_BUSY:['請等待目前檔案操作完成。','Wait for the current file operation.'],
  PDF_TIMEOUT:['PDF 產生逾時，原檔保持不變，請重試。','PDF generation timed out. The original file is unchanged. Try again.'],
  SAVE_EXTENSION_CHANGED:['請保留 PDF 副檔名。','Keep the PDF file extension.'],
  SAVE_CANCELLED:['已取消儲存。','Save cancelled.'],
  OPEN_CANCELLED:['已取消選擇資料夾。','Folder selection cancelled.']
 };
 const message=e=>labels[e?.code]?text(...labels[e.code]):text('操作未完成，原有資料與備份保持不變，請重試。','Operation did not complete. Existing data and backups are unchanged. Try again.');
 const notice=(value,error=false)=>api?.toast(value,error?'error':'info');
 const date=value=>{const d=new Date(value);return Number.isFinite(+d)?d.toLocaleString(root.SalaryMateI18n?.language?.()==='en'?'en-US':'zh-TW'):'';};
 function schedule(){clearTimeout(timer);if(options?.enabled)timer=setTimeout(()=>{void automatic();},options.intervalMinutes*60000);}
 async function capture(reason){
  if(!api?.canBackup())throw Object.assign(Error('NOT_READY'),{code:'NOT_READY'});
  const version=revision,data=await api.snapshot();
  const result=await bridge.backupSnapshot({data,reason});
  if(result.verified||result.skipped){savedRevision=version;lastEntry=result.entry||lastEntry;lastError='';}
  return result;
 }
 async function automatic(){
  if(busy||!options?.enabled||revision===savedRevision||!api?.canBackup()){schedule();return;}
  busy=true;
  try{await capture('auto');}
  catch(e){const next=message(e);if(next!==lastError)notice(next,true);lastError=next;}
  finally{busy=false;schedule();}
 }
 function sectionHTML(){return `<details class="v5-settings-section v5-settings-disclosure"><summary class="v5-settings-summary"><span class="v5-group-title">${text('桌面工具','Desktop tools')}</span></summary><div class="v5-settings-content">${[['updates','桌面更新中心','Desktop update center','檢查新版、下載校驗與更新前備份','Check releases, verify downloads and back up before updating'],['backups','自動備份','Automatic backups','歷史版本、還原預覽與保存份數','History, restore preview and retention'],['options','快捷登記','Quick entry','快捷鍵、系統匣與背景執行','Shortcut, tray and background mode'],['pdf','年度報表 PDF','Annual report PDF','依目前公司範圍與年度輸出 A4 報表','A4 report for the selected company scope and year']].map(([action,zh,en,dzh,den])=>`<div class="v5-setting-row"><div><h3>${text(zh,en)}</h3><p>${text(dzh,den)}</p></div><button type="button" class="btn btn-small" data-desktop-action="${action}">${text('開啟','Open')}</button></div>`).join('')}</div></details>`;}
 const button=(action,zh,en,extra='')=>`<button type="button" class="btn btn-small" data-desktop-action="${action}" ${extra}>${text(zh,en)}</button>`;
 function available(){if(!api)return false;if(!api.canOpen()){notice(text('請先完成或關閉目前的編輯視窗。','Finish or close the current dialog first.'),true);return false;}return true;}
 function quick(){
  if(!available())return;
  api.open(text('快捷登記','Quick entry'),`<section id="desktopQuickPanel"><p>${text('目前公司：','Current company: ')}${esc(api.company())}</p><div class="v5-export-options">${button('record','新增薪資','Add salary')}${button('overtime','記加班','Overtime')}${button('leave','記請假','Leave')}${button('transaction','股票交易','Stock transaction')}</div><p class="hint">${text('沿用現有表單與檢查；儲存後才變更資料。','Uses the existing forms and checks. Data changes only after saving.')}</p></section>`,false);
 }
 function configForm(){
  const p=options;
  return `<form id="desktopOptionsForm"><p class="hint">${text('自動備份僅在程式執行期間排程；沒有資料變更時不新增版本。','Automatic backups run while the app is running; unchanged data does not create another version.')}</p><p style="overflow-wrap:anywhere">${text('資料夾：','Folder: ')}${esc(p.directory||text('尚未選擇','Not selected'))}</p><div class="form-actions">${button('choose-folder','選擇資料夾','Choose folder')}</div><div class="form-grid"><label><span class="field-label">${text('自動備份','Automatic backups')}</span><select class="field-select" name="enabled"><option value="false" ${!p.enabled?'selected':''}>${text('關閉','Off')}</option><option value="true" ${p.enabled?'selected':''}>${text('開啟','On')}</option></select></label><label><span class="field-label">${text('備份間隔','Backup interval')}</span><select class="field-select" name="intervalMinutes">${[5,15,60].map(n=>`<option value="${n}" ${p.intervalMinutes===n?'selected':''}>${n} ${text('分鐘','minutes')}</option>`).join('')}</select></label><label><span class="field-label">${text('保留版本','Keep versions')}</span><select class="field-select" name="retention">${[10,30,60].map(n=>`<option value="${n}" ${p.retention===n?'selected':''}>${n}</option>`).join('')}</select></label><label><span class="field-label">${text('快捷鍵與背景常駐','Shortcut and background mode')}</span><select class="field-select" name="shortcutEnabled"><option value="false" ${!p.shortcutEnabled?'selected':''}>${text('關閉','Off')}</option><option value="true" ${p.shortcutEnabled?'selected':''}>${text('開啟','On')}</option></select></label><label class="span-2"><span class="field-label">${text('快捷登記按鍵','Quick entry shortcut')}</span><select class="field-select" name="shortcut">${['CommandOrControl+Shift+M','CommandOrControl+Alt+M','CommandOrControl+Shift+Y'].map(key=>`<option value="${key}" ${p.shortcut===key?'selected':''}>${key.replace('CommandOrControl',bridge.platform==='darwin'?'⌘':'Ctrl').replace('Alt',bridge.platform==='darwin'?'Option':'Alt')}</option>`).join('')}</select></label></div><p class="hint">${text('啟用快捷鍵後，關閉視窗會保留背景執行；請從系統匣／選單列選「結束」以完全退出。未啟用時沿用原本關閉行為。','With shortcuts enabled, closing the window keeps the app in the background. Choose Quit from the tray/menu bar to exit. Otherwise, the existing close behavior is retained.')}</p><p class="notice">${text('自動備份為一般 JSON，包含薪資與投資資料。請選私人資料夾；加密備份仍可從資料管理手動匯出。保存到 Drive 資料夾不代表雲端同步已完成。','Automatic backups are plain JSON containing salary and investment data. Choose a private folder; encrypted backups remain available under Data management. Saving in a Drive folder does not confirm cloud sync completion.')}</p><p role="status" data-desktop-status></p><div class="form-actions"><button type="button" class="btn" data-action="close-dialog">${text('取消','Cancel')}</button><button type="submit" class="btn btn-primary">${text('儲存設定','Save settings')}</button></div></form>`;
 }
 async function openOptions(){const state=await bridge.featuresState();options=state.options;schedule();api.open(text('桌面設定','Desktop settings'),configForm(),true);if(state.shortcutProblem)notice(message({code:state.shortcutProblem}),true);}
 async function history(){
  const state=await bridge.featuresState();options=state.options;
  const {entries}=await bridge.backupHistory();
  const reasons={auto:text('自動','Automatic'),manual:text('手動','Manual'),'before-import':text('匯入前','Before import')};
  api.open(text('自動備份與歷史版本','Automatic backups and history'),`<section id="desktopBackupPanel"><p>${options.enabled?text('自動備份已開啟','Automatic backups are on'):text('自動備份尚未開啟','Automatic backups are off')} · ${options.intervalMinutes} ${text('分鐘','minutes')} · ${text('保留','Keep')} ${options.retention} ${text('份','versions')}</p><p class="hint" style="overflow-wrap:anywhere">${esc(options.directory||text('請先選擇備份資料夾','Choose a backup folder first'))}</p>${lastError?`<p role="alert" class="notice">${esc(lastError)}</p>`:''}<div class="form-actions">${button('options','設定','Settings')}${button('backup-now','立即備份','Back up now',options.directory?'':'disabled')}${button('backups','重新整理','Refresh')}</div><p class="hint">${text('啟用後，匯入前會先保存目前資料；若備份失敗，匯入會停止。歷史版本先校驗，再使用既有匯入預覽，可選「完整還原 → 全部取代」。','When enabled, current data is saved before importing; a failed backup stops the import. History is verified before the existing import preview. Choose Full restore → Replace all to restore a version.')}</p>${entries.length?`<div class="table-scroll"><table><thead><tr><th>${text('時間／原因','Time / reason')}</th><th>${text('薪資／加班／請假','Salary / overtime / leave')}</th><th>${text('股票紀錄','Stock records')}</th><th>${text('操作','Action')}</th></tr></thead><tbody>${entries.map(entry=>`<tr><td>${esc(date(entry.createdAt))}<br><small>${esc(reasons[entry.reason])}</small></td><td>${esc(entry.summary?.records)} / ${esc(entry.summary?.overtimeLogs)} / ${esc(entry.summary?.leaveRecords)}</td><td>${esc(entry.summary?.transactions)}</td><td>${button('restore','預覽','Preview',`data-backup-id="${esc(entry.id)}"`)}</td></tr>`).join('')}</tbody></table></div>`:`<p>${text('尚無歷史版本。','No backup versions yet.')}</p>`}<p role="status" data-desktop-status></p></section>`,true);
 }
 async function savePdf(){
  if(busy){notice(message({code:'DESKTOP_BUSY'}),true);return;}
  if(!api?.canBackup())return;
  busy=true;notice(text('請選擇 PDF 儲存位置；完成後會驗證檔案。','Choose a PDF save location; the file will be verified.'));
  try{const result=await bridge.exportPdf(api.report());if(!result.verified)throw Error('PDF_FAILED');notice(text('PDF 已儲存並驗證：','PDF saved and verified: ')+result.fileName);}
  catch(e){notice(message(e),!String(e.code).endsWith('CANCELLED'));}
  finally{busy=false;}
 }
 async function action(name,buttonNode){
  if(!api){pendingAction=name;return;}
  const own=root.document.querySelector('#desktopQuickPanel, #desktopOptionsForm, #desktopBackupPanel, #desktopUpdatePanel');
  if(own&&api.hasChanges?.()){notice(text('請先儲存設定，或取消目前的變更。','Save the settings or cancel the current changes first.'),true);return;}
  if(!own&&!available())return;
  if(busy){notice(message({code:'DESKTOP_BUSY'}),true);return;}
  if(name==='quick'){if(own)api.close();quick();return;}
  if(['record','overtime','leave','transaction'].includes(name)){if(own)api.close();api.quick(name);return;}
  if(name==='pdf'){if(own)api.close();api.previewReport();return;}
  busy=true;
  try{
    if(name==='updates')await root.SalaryMateDesktopUpdates.open();
    else if(name==='options')await openOptions();
    else if(name==='backups')await history();
    else if(name==='choose-folder'){const result=await bridge.chooseBackupDirectory();options=result.options;schedule();await openOptions();}
    else if(name==='backup-now'){const result=await capture('manual');await history();notice(text('備份已儲存並驗證：','Backup saved and verified: ')+date(result.entry.createdAt));}
    else if(name==='restore'){
      const result=await bridge.readBackup(buttonNode?.dataset.backupId);
      if(!result.verified)throw Error('BACKUP_INTEGRITY');
      if(api.close()!==false)await api.importBackup(result.data);
    }
  }catch(e){lastError=message(e);notice(lastError,!String(e.code).endsWith('CANCELLED'));}
  finally{busy=false;}
 }
 root.document.addEventListener('click',event=>{const node=event.target.closest?.('[data-desktop-action]');if(!node||node.disabled)return;event.preventDefault();event.stopImmediatePropagation();void action(node.dataset.desktopAction,node);},true);
 root.document.addEventListener('submit',event=>{
  const form=event.target;if(form?.id!=='desktopOptionsForm')return;event.preventDefault();event.stopImmediatePropagation();
  if(busy||!form.reportValidity())return;busy=true;const status=form.querySelector('[data-desktop-status]'),submit=form.querySelector('[type="submit"]');submit.disabled=true;
  const d=new FormData(form),next={enabled:d.get('enabled')==='true',intervalMinutes:Number(d.get('intervalMinutes')),retention:Number(d.get('retention')),shortcutEnabled:d.get('shortcutEnabled')==='true',shortcut:d.get('shortcut')};
  void(async()=>{
    try{const r=await bridge.configureFeatures(next);options=r.options;api.settingsSaved?.();schedule();status.textContent=text('設定已儲存。','Settings saved.');if(options.enabled){revision++;await capture('auto');status.textContent=text('設定已儲存，備份已完成驗證。','Settings saved and backup verified.');}}
    catch(e){status.textContent=message(e);lastError=message(e);}
    finally{busy=false;submit.disabled=false;}
  })();
 },true);
 const unsubscribe=bridge.onDesktopAction(name=>{void action(name);});
 root.addEventListener('pagehide',()=>{clearTimeout(timer);unsubscribe();});
 root.SalaryMateDesktopFeatures=Object.freeze({sectionHTML,savePdf,changed(){revision++;},async beforeImport(){
   if(!options)try{options=(await bridge.featuresState()).options;}catch(e){notice(message(e),true);return false;}
   if(!options.enabled)return true;
   try{await capture('before-import');return true;}catch(e){notice(message(e),true);return false;}
  },attach(app){
   api=app;root.SalaryMateDesktopUpdates?.attach(app);
   void bridge.featuresState().then(state=>{options=state.options;schedule();if(pendingAction){const next=pendingAction;pendingAction=null;void action(next);}}).catch(e=>notice(message(e),true));
  }});
})(globalThis);
