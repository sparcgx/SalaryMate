/* Desktop update center: no requests until the user chooses Check. */
(function(root){
 'use strict';const bridge=root.SalaryMateDesktop;if(!bridge)return;
 const text=(zh,en)=>root.SalaryMateI18n?.language?.()==='en'?en:zh;
 const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const mb=value=>(Number(value||0)/1048576).toFixed(1)+' MB';
 const date=value=>value?new Date(value).toLocaleString(root.SalaryMateI18n?.language?.()==='en'?'en-US':'zh-TW'):text('尚未檢查','Not checked');
 const phases={applying:['正在校驗並套用套件…','Verifying and applying package…'],restarting:['套件已就緒，正在重新啟動…','Package ready; restarting…'],checking:['檢查更新中…','Checking for updates…'],choosing:['請選擇更新檔位置','Choose an update location'],downloading:['正在下載','Downloading'],verifying:['正在讀回校驗','Verifying saved bytes'],ready:['更新檔已通過校驗','Update verified'],cancelled:['已取消，原檔保持不變','Cancelled; the original file is unchanged'], 'backing-up':['正在保存更新前備份','Saving the pre-update backup'],opened:['安裝檔已開啟，正在結束程式','Installer opened; closing SalaryMate']};
 const errors={
  UPDATE_STATE_WRITE:['無法保存更新狀態，版本尚未切換。請確認磁碟空間與資料夾寫入權限，再重試。','Unable to save update state. The version was not switched. Check free disk space and folder write permissions, then retry.'],
  UPDATE_PACKAGE_INVALID:['更新套件格式或發行資訊不符，未套用更新。','Package format or release information mismatch. The update was not applied.'],
  UPDATE_PACKAGE_INCOMPATIBLE:['此套件與目前主系統不相容，請重新檢查新版；主系統變更時需安裝完整版本。','This package is incompatible with the runtime. Check again; runtime changes require a full installer.'],
  UPDATE_NO_ROLLBACK:['目前沒有可還原的上一版程式。','No previous application version is available.'],
  UPDATE_NETWORK:['無法連線，請確認網路後重試。','Unable to connect. Check your network and try again.'],
  UPDATE_RATE_LIMIT:['GitHub 暫時限制查詢次數，請稍後再試。','GitHub temporarily limited requests. Try again later.'],
  UPDATE_TIMEOUT:['連線逾時，原檔保持不變，可重新下載。','The connection timed out. The original file is unchanged; retry the download.'],
  UPDATE_INVALID:['發行資訊不完整或來源不符，已停止更新。','Release information is incomplete or the source does not match. Update stopped.'],
  UPDATE_UNAVAILABLE:['目前無法取得正式桌面版資訊，請稍後重試。','Formal desktop release information is unavailable. Try again later.'],
  UPDATE_CHECK_REQUIRED:['請先檢查新版，並確認有對應此電腦的安裝檔。','Check for updates first and confirm an installer is available for this computer.'],
  UPDATE_EXTENSION:['請保留原本的安裝檔副檔名。','Keep the original installer extension.'],
  UPDATE_DOWNLOAD_FAILED:['下載未完成，原檔保持不變，請重試。','Download did not complete. The original file is unchanged; try again.'],
  UPDATE_INTEGRITY:['更新檔大小或 SHA-256 不符，已停止套用；請重新下載。','Update size or SHA-256 mismatch. Applying was blocked; download again.'],
  UPDATE_NOT_DOWNLOADED:['請先下載並完成校驗。','Download and verify the installer first.'],
  UPDATE_BACKUP_FAILED:['更新前備份未完成，未開啟安裝檔。請重試備份。','The pre-update backup failed. The installer was not opened; retry the backup.'],
  UPDATE_OPEN_FAILED:['系統未能開啟安裝檔；備份已保留，可開啟資料夾查看。','The system could not open the installer. Your backup was retained; open its folder to inspect.'],
  DESKTOP_BUSY:['請先完成目前的檔案操作。','Finish the current file operation first.'],
  DIALOG_BUSY:['請先完成或關閉目前的編輯視窗。','Finish or close the current editing dialog first.']
 };
 let api,state=null,busy=false,localError='';
 const running=s=>['checking','choosing','downloading','verifying','backing-up','applying','restarting'].includes(s?.phase);
 const caption=s=>s.phase==='error'?text('更新尚未完成','Update not completed'):phases[s.phase]?text(...phases[s.phase]):!s.checkedAt?text('按「檢查新版」查詢','Choose Check for updates'):!s.fresh?text('上次檢查結果，請重新檢查','Previous result; check again'):s.available?text('有新版本可下載','A newer version is available'):text('目前沒有較新的桌面版本','No newer desktop version is available');
 const errorMessage=code=>errors[code]?text(...errors[code]):text('操作未完成，請重試。','The operation did not complete. Try again.');
 const versionLabel=v=>v?`v${v.version} · ${text('桌面封裝','Desktop package')} ${v.sequence}`:'—';
 function content(s){
  const active=running(s),download=s.downloaded,latest=s.latest;
  const selected=latest?.delivery?.asset||latest?.asset,isPackage=latest?.delivery?.kind==='content';
  const packageIntro=s.content?.enabled?`<div class="notice"><strong>${text('更新套件已啟用','Update packages enabled')}</strong><p>${text('一般功能、介面與行情模組可只更新程式內容，不重複下載主系統。相容時優先使用差異套件；主系統變更才需要完整安裝檔。','Features, interface and market modules can update without downloading the runtime. A matching delta package is preferred; runtime changes require a full installer.')}</p><p class="hint">${text('已安裝主系統：','Installed runtime: ')}${esc(s.content.baseTag)}</p></div>`:'';
  const delivery=latest&&s.available?`<p class="hint">${isPackage?text(selected.delta?'本次為差異更新套件，只下載變更檔案。':'本次為完整內容套件，不包含主系統。',selected.delta?'This delta package downloads changed files only.':'This content package excludes the runtime.'):text(latest.delivery?.reason==='runtime'?'本次主系統有變更，需下載完整安裝檔。':'此版本提供完整安裝檔。',latest.delivery?.reason==='runtime'?'This release changes the runtime and requires a full installer.':'This release provides a full installer.')}${isPackage&&latest.asset?` ${text('套件大小','Package size')} ${mb(selected.size)} / ${text('完整安裝檔','Full installer')} ${mb(latest.asset.size)}`:''}</p>`:'';
  return `<section id="desktopUpdatePanel">${packageIntro}${s.content?.storageError?`<p class="notice" role="alert">${text('無法保存版本還原紀錄，已開啟驗證可用的程式。更新套件暫停使用；請確認磁碟空間與資料夾寫入權限後重新開啟。','Unable to save version recovery state. Verified application content is open. Package updates are paused; check free disk space and folder write permissions, then reopen.')}</p>`:''}${s.content?.rolledBack?`<p class="notice" role="status">${text('上次更新未能完成啟動，已自動還原可用版本；原有紀錄仍保留。','The last update could not finish starting. A working version was restored; your records were retained.')}</p>`:''}<div class="v5-setting-row"><div><h3>SalaryMate ${esc(versionLabel(s.current))}</h3><p>${esc(s.current.platform==='win32'?'Windows 64 位元':s.current.arch==='arm64'?'Mac M 系列':'Mac')} · build ${esc(s.current.build)}</p></div><button type="button" class="btn btn-small" data-update-action="check" ${active?'disabled':''}>${text('檢查新版','Check for updates')}</button></div><div class="v5-setting-row"><div><h3>${text('最新正式桌面版','Latest desktop release')}</h3><p>${esc(versionLabel(latest))}</p><p class="hint">${text('上次檢查：','Last checked: ')}${esc(date(s.checkedAt))}</p></div>${latest?`<a class="btn btn-small" href="${esc(latest.url)}" target="_blank" rel="noopener noreferrer">${text('發行頁','Release page')}</a>`:''}</div><p role="status" aria-live="polite" data-update-status>${esc(caption(s))}</p><div data-update-progress ${['downloading','verifying'].includes(s.phase)?'':'hidden'}><progress aria-label="${text('更新進度','Update progress')}" max="${s.total||1}" value="${s.bytes||0}" style="width:100%"></progress><p class="hint" data-update-bytes>${mb(s.bytes)} / ${mb(s.total)}</p></div><p role="alert" class="notice" data-update-error ${localError||s.error?'':'hidden'}>${esc(localError||(s.error?errorMessage(s.error):''))}</p>${latest&&s.available&&!selected?`<p class="notice">${text('此發行尚無可驗證、適用此電腦的安裝檔；可查看發行頁。','This release has no verifiable installer for this computer. See its release page.')}</p>`:''}${delivery}<div class="form-actions"><button type="button" class="btn btn-primary" data-update-action="download" ${!s.canDownload||active?'disabled':''}>${isPackage?text('下載更新套件','Download package'):text('下載完整安裝檔','Download installer')}${selected?' · '+mb(selected.size):''}</button><button type="button" class="btn" data-update-action="cancel" ${['checking','downloading','verifying'].includes(s.phase)?'':'hidden'}>${text('取消','Cancel')}</button><button type="button" class="btn" data-update-action="reveal" ${!download||active?'disabled':''}>${text('開啟資料夾','Open folder')}</button><button type="button" class="btn btn-primary" data-update-action="install" ${!download||active?'disabled':''}>${(download?.kind==='content'||isPackage)?text('備份並重新啟動套用','Back up, apply and restart'):text('備份並安裝','Back up and install')}</button>${s.content?.enabled?`<button type="button" class="btn" data-update-action="import" ${!s.canDownload||!isPackage||active?'disabled':''}>${text('匯入更新套件','Import package')}</button><button type="button" class="btn" data-update-action="rollback" ${!s.content.canRollback||active?'disabled':''}>${text('還原上一版程式','Restore previous version')}</button>`:''}</div>${download?`<p class="hint" style="overflow-wrap:anywhere">${esc(download.fileName)}<br>SHA-256：${esc(download.sha256)}</p>`:''}<p class="hint">${text('檢查更新只查詢公開版本資訊，不傳送薪資或投資資料。下載完成不代表已安裝。','Update checks request public release information only; salary and investment data is not sent. Downloading does not install the update.')}</p>${s.content?.enabled?`<p class="hint">${text('套用套件前會保存更新前備份，啟動成功才保留新版。若啟動失敗，會自動還原；也可手動還原上一版程式。匯入套件前請先檢查新版，以核對官方檔案。','A verified backup is required before applying. The new content becomes current only after startup succeeds; a failed startup rolls back. You can also restore the previous version. Check for updates before importing a package to verify its official digest.')}</p>`:''}<p class="hint">${text('「備份並安裝」會先請你選擇私人位置保存一般 JSON 備份，驗證成功後才開啟安裝檔並結束本程式。Windows 依精靈操作；Mac 拖到 Applications 取代原程式。','Back up and install first asks for a private location for a plain JSON backup. After verification, the installer opens and this app quits. Follow the Windows wizard; on Mac drag the app to Applications and replace the existing app.')}</p><p class="hint">${text('Windows 尚無發行者憑證；Mac 尚無 Apple 公證。SHA-256 可核對檔案完整性，不能取代發行者簽章。','Windows has no publisher certificate; Mac has no Apple notarization. SHA-256 checks file integrity and does not replace publisher signing.')}</p>${latest?`<details class="v5-explanation"><summary>${text('更新說明','Release notes')} · ${esc(date(latest.publishedAt))}</summary><p style="white-space:pre-wrap;overflow-wrap:anywhere">${esc(latest.notes||text('請查看發行頁。','See the release page.'))}</p></details>`:''}<div class="form-actions"><button class="btn" type="button" data-action="close-dialog">${text('返回','Back')}</button></div></section>`;
 }
 function paint(next){
  const previous=state;state=next;const panel=root.document.querySelector('#desktopUpdatePanel');if(!panel)return;
  if(previous?.phase===next.phase&&['downloading','verifying'].includes(next.phase)){
   const bar=panel.querySelector('progress');if(bar){bar.max=next.total||1;bar.value=next.bytes||0;}const label=panel.querySelector('[data-update-bytes]');if(label)label.textContent=mb(next.bytes)+' / '+mb(next.total);return;
  }
  const focus=root.document.activeElement?.dataset?.updateAction;panel.outerHTML=content(next);
  if(focus)root.document.querySelector(`[data-update-action="${focus}"]:not([disabled]):not([hidden])`)?.focus({preventScroll:true});
 }
 async function open(){localError='';const next=await bridge.updateState();state=next;api.open(text('桌面更新中心','Desktop update center'),content(next),true);}
 async function action(kind){
  if(kind==='cancel'){try{await bridge.cancelUpdate();}catch(e){api.toast(errorMessage(e.code),'error');}return;}
  if(busy||running(state))return;busy=true;localError='';
  try{
   if(kind==='check')paint(await bridge.checkUpdates());
   else if(kind==='download')paint(await bridge.downloadUpdate());
   else if(kind==='import')paint(await bridge.importUpdate());
   else if(kind==='rollback'){
    if(api.hasChanges?.()||!api.canBackup())throw Object.assign(Error('DIALOG_BUSY'),{code:'DIALOG_BUSY'});
    paint(await bridge.rollbackUpdate(await api.snapshot()));
   }
   else if(kind==='reveal')paint(await bridge.revealUpdate());
   else if(kind==='install'){
    if(api.hasChanges?.()||!api.canBackup())throw Object.assign(Error('DIALOG_BUSY'),{code:'DIALOG_BUSY'});
    const data=await api.snapshot();paint(await bridge.installUpdate(data));
   }
  }catch(e){
   if(e.code!=='UPDATE_CANCELLED')localError=errorMessage(e.code);
   try{paint(await bridge.updateState());}catch{if(state)paint({...state,phase:'error'});}
  }finally{busy=false;}
 }
 root.document.addEventListener('click',event=>{const node=event.target.closest?.('[data-update-action]');if(!node||node.disabled)return;event.preventDefault();event.stopImmediatePropagation();void action(node.dataset.updateAction);},true);
 const unsubscribe=bridge.onUpdateState(next=>{localError='';paint(next);});
 root.addEventListener('pagehide',()=>unsubscribe());
 root.SalaryMateDesktopUpdates=Object.freeze({attach:app=>{api=app;},open});
})(globalThis);
