/* Google Drive controls. Local data stays local until an explicit save or session auto-save. */
(function(root){
  'use strict';
  function create(api){
    const g=root.SalaryMateGoogleDrive,esc=api.escapeHtml,user=api.userHtml||esc;
    let ready=false,busy=false,files=[],pageToken='',message='',panelSerial=0,auto=null,timer=null,lastSaved='',lastFingerprint='';
    const client=g.createClient(state=>{if(!state.connected){stopAuto(false);files=[];pageToken='';lastSaved='';lastFingerprint='';}refreshStatus();});
    const $=selector=>root.document.querySelector(selector),panel=()=>$('#googleDrivePanel'),active=el=>!!el?.isConnected&&!!$('#appDialog')?.open;
    const text=value=>root.SalaryMateI18n?.text(value)||value;
    const fingerprint=payload=>{const {exportInfo,updatedAt,uiPreferences,...data}=payload;return JSON.stringify(data);};
    const localTime=value=>value?new Date(value).toLocaleString(root.SalaryMateI18n?.language?.()==='en'?'en-US':'zh-TW'):'';
    function summary(){return auto?'Google Drive 自動儲存已開啟':client.status().connected?'Google Drive 已連線':'儲存至自己的 Google Drive，可選密碼加密';}
    function refreshStatus(){
      if(!root.document)return;
      const state=client.status(),p=panel();
      root.document.querySelectorAll('[data-google-summary]').forEach(el=>el.textContent=text(summary()));
      if(!p)return;
      $('[data-drive-account]').textContent=state.user?(state.user.emailAddress||state.user.displayName):text('尚未連線');
      $('[data-drive-message]').textContent=text(message);
      $('[data-drive-session]').textContent=text(auto?(auto.password?'本次開啟期間自動加密儲存':'本次開啟期間自動儲存'):'自動儲存未開啟');
      $('[data-drive-last]').textContent=lastSaved?text('最近儲存')+' · '+localTime(lastSaved):'';
      p.querySelectorAll('[data-drive-connected]').forEach(el=>el.hidden=!state.connected);
      p.querySelectorAll('[data-drive-disconnected]').forEach(el=>el.hidden=state.connected);
      p.querySelectorAll('[data-drive-action]').forEach(button=>{const action=button.dataset.driveAction;button.disabled=busy||state.busy||(action==='connect'&&(!ready||!g.supported()||!g.validClientId(client.clientId())))||(action==='stop-auto'&&!auto);});
      root.SalaryMateI18n?.apply(p);
    }
    function renderFiles(){
      const list=$('[data-drive-files]');if(!list)return;
      list.innerHTML=files.length?files.map(file=>`<li class="drive-file"><div><strong>${user(file.name)}</strong><small>${esc(localTime(file.modifiedTime))} · ${file.appProperties.encrypted==='true'?'加密備份':'一般備份'} · ${Math.max(1,Math.ceil(Number(file.size||0)/1024))} KB</small></div><div class="drive-file-actions"><button class="btn btn-small" type="button" data-drive-action="restore" data-id="${esc(file.id)}">還原</button><button class="btn btn-small" type="button" data-drive-action="rename" data-id="${esc(file.id)}">編輯名稱</button><button class="btn btn-small" type="button" data-drive-action="trash" data-id="${esc(file.id)}">刪除</button></div></li>`).join(''):'<li class="hint">目前沒有雲端備份。可先儲存一份，或重新整理清單。</li>';
      const more=$('[data-drive-action="more"]');if(more)more.hidden=!pageToken;refreshStatus();
    }
    async function run(fn){
      if(busy)return;busy=true;message='處理中…';refreshStatus();
      try{return await fn();}catch(error){message=error.message||'Google Drive 操作失敗。';api.toast(message,'error');}
      finally{busy=false;refreshStatus();}
    }
    async function refresh(more=false){const result=await client.list(more?pageToken:'');files=more?[...files,...result.files]:result.files;files=[...new Map(files.map(f=>[f.id,f])).values()];pageToken=result.nextPageToken;message='雲端備份清單已更新';renderFiles();}
    function open(){
      panelSerial++;
      const supported=g.supported(),id=client.clientId(),origin=supported?root.location.origin:'https://salarymate.sparcgx2420.chatgpt.site';
      api.openDialog('自己的 Google Drive',`<section id="googleDrivePanel"><p>薪資、加班、請假與投資備份由瀏覽器直接傳送到你選擇的 Google 帳戶。網站伺服器不接收備份內容。</p><div class="drive-connection"><div><b data-drive-account></b><small data-drive-session></small><small data-drive-last></small></div><div class="form-actions"><button class="btn btn-primary" type="button" data-drive-action="connect" data-drive-disconnected>連線 Google Drive</button><button class="btn" type="button" data-drive-action="disconnect" data-drive-connected>中斷連線</button><button class="btn" type="button" data-drive-action="revoke" data-drive-connected>撤銷授權</button></div></div>${!supported?'<p class="notice warning">Google 連線需要 HTTPS 網站或 localhost；直接開啟 HTML 檔案時，請改用網站版或下載備份。</p>':''}<details class="drive-setup" ${!id?'open':''}><summary>首次連線設定</summary><p>使用自己的 Google Cloud 專案；只需設定一次，之後在這個瀏覽器直接連線。</p><ol><li>在 Google Cloud 建立專案並啟用 Google Drive API。</li><li>設定 Google Auth Platform 的品牌資訊、目標對象與資料存取權，加入 drive.file 權限。測試模式須加入自己的 Google 帳戶。</li><li>建立「網頁應用程式」OAuth 用戶端，將下列網址加入「已授權的 JavaScript 來源」。請只填網域來源，不包含頁面路徑。</li></ol><input class="field drive-origin" aria-label="已授權的 JavaScript 來源" value="${esc(origin)}" readonly><p><a href="https://console.cloud.google.com/apis/library/drive.googleapis.com" target="_blank" rel="noopener noreferrer">開啟 Google Cloud 設定</a> · <a href="https://developers.google.com/identity/oauth2/web/guides/get-google-api-clientid" target="_blank" rel="noopener noreferrer">Google 官方設定說明</a></p><form id="googleDriveConfig"><label><span class="field-label">Google OAuth 用戶端 ID</span><input class="field" name="clientId" value="${esc(id)}" placeholder="123456789-example.apps.googleusercontent.com" maxlength="220" autocomplete="off" spellcheck="false" required></label><p class="hint">只需用戶端 ID，不需要密鑰、Google 密碼或 API 金鑰。此設定只保存在目前瀏覽器，不會放進備份。</p><div class="form-actions"><button class="btn" type="button" data-drive-action="clear-config">刪除連線設定</button><button class="btn btn-primary" type="submit">儲存連線設定</button></div></form></details><div data-drive-connected><div class="drive-toolbar"><button class="btn btn-primary" type="button" data-drive-action="save">儲存一份</button><button class="btn" type="button" data-drive-action="auto">自動儲存設定</button><button class="btn" type="button" data-drive-action="stop-auto">停止自動儲存</button><button class="btn" type="button" data-drive-action="refresh">重新整理</button></div><p class="hint">備份存放於 Google Drive 的「個人薪資與投資管理」資料夾。每次儲存都新增一份，方便保留各裝置的版本；不會自動合併或取代本機資料。</p><ul class="drive-files" data-drive-files></ul><button class="btn" type="button" data-drive-action="more" hidden>載入更多</button></div><p class="drive-status" data-drive-message role="status" aria-live="polite"></p><p class="hint">本機仍保留離線資料。關閉頁面或授權到期後須重新連線；關閉頁面期間不會同步。一般備份可直接讀取，加密備份需自行保管密碼。只要求本工具建立或你明確授權的檔案權限。</p><a href="https://myaccount.google.com/connections" target="_blank" rel="noopener noreferrer">管理 Google 帳戶的第三方連線</a></section>`,true);
      renderFiles();refreshStatus();
      if(supported)g.loadIdentity().then(()=>{ready=true;refreshStatus();}).catch(error=>{message=error.message;refreshStatus();});
      $('#googleDriveConfig').addEventListener('submit',event=>{event.preventDefault();if(busy)return;try{client.configure(event.target.elements.clientId.value);message='連線設定已儲存，請點擊連線 Google Drive。';refreshStatus();}catch(error){message=error.message;refreshStatus();}});
    }
    const nameForBackup=()=>`PSIMS_${new Date().toISOString().replace(/[:.]/g,'-')}`;
    function openSave(mode){
      const autoMode=mode==='auto';
      api.openDialog(autoMode?'自動儲存設定':'儲存到 Google Drive',`<form id="googleDriveSave" data-mode="${mode}"><p>${autoMode?'先儲存目前資料；之後每次資料變更會在 10 秒後儲存一份新備份。僅本次開啟頁面期間有效。':'儲存目前已儲存的公司、薪資、加班、請假與全部投資資料。'}</p><p>${text('Google 帳戶')}：${user(client.status().user?.emailAddress||'')}</p>${!autoMode?`<label><span class="field-label">備份名稱</span><input class="field" name="name" maxlength="160" value="${esc(nameForBackup())}" required></label>`:''}<label class="backup-choice"><input type="checkbox" name="encrypted"><span><b>使用密碼加密（選用）</b><small>在瀏覽器完成加密後，才上傳至 Google Drive。</small></span></label><fieldset class="drive-passwords" hidden disabled><label><span class="field-label">備份密碼（至少 8 個字元）</span><input class="field" type="password" name="password" minlength="8" maxlength="1024" autocomplete="new-password" required></label><label><span class="field-label">再次輸入密碼</span><input class="field" type="password" name="confirmation" autocomplete="new-password" required></label></fieldset><p class="hint">密碼不會寫入裝置儲存或送到伺服器。自動加密期間只暫存於目前頁面的記憶體；停止自動儲存、斷線或關閉頁面即清除。</p><p class="drive-status" role="status"></p><div class="form-actions"><button class="btn" type="button" data-drive-action="back">返回</button><button class="btn btn-primary" type="submit">${autoMode?'儲存並啟用':'儲存到 Google Drive'}</button></div></form>`,true);
      const form=$('#googleDriveSave');
      form.elements.encrypted.addEventListener('change',()=>{const fields=form.querySelector('fieldset');fields.hidden=fields.disabled=!form.elements.encrypted.checked;});
      form.addEventListener('submit',async event=>{
        event.preventDefault();if(busy||!form.reportValidity())return;
        const encrypted=form.elements.encrypted.checked,password=encrypted?form.elements.password.value:'';
        if(encrypted&&password!==form.elements.confirmation.value){form.querySelector('[role="status"]').textContent=text('兩次密碼不一致，請重新確認。');return;}
        const account=client.status().user?.permissionId,snapshot=api.snapshot(),plainFingerprint=fingerprint(snapshot),button=form.querySelector('[type="submit"]');
        button.disabled=true;const result=await run(async()=>{
          let payload=encrypted?await root.SalaryMateBackup.encrypt(snapshot,password):snapshot;
          if(!active(form)||!client.status().connected||client.status().user?.permissionId!==account)throw new Error('Google 連線已取消。');
          const file=await client.upload(payload,autoMode?nameForBackup():form.elements.name.value);
          lastSaved=new Date().toISOString();lastFingerprint=plainFingerprint;
          if(autoMode){auto={password,account};message='自動儲存已開啟';changed();}else message='備份已儲存至自己的 Google Drive';
          files=[file,...files.filter(x=>x.id!==file.id)];form.elements.password.value='';form.elements.confirmation.value='';return true;
        });
        if(active(form)){button.disabled=false;if(result)open();else form.querySelector('[role="status"]').textContent=text(message);}
      });
    }
    function stopAuto(announce=true){root.clearTimeout(timer);timer=null;auto=null;if(announce){message='自動儲存已停止';refreshStatus();}}
    function changed(){
      if(!auto)return;root.clearTimeout(timer);timer=root.setTimeout(()=>saveAuto(),10000);
    }
    async function saveAuto(){
      timer=null;if(!auto)return;
      if(busy||client.status().busy){changed();return;}
      const session=auto;
      if(!client.status().connected||client.status().user?.permissionId!==session.account){stopAuto();return;}
      const snapshot=api.snapshot(),key=fingerprint(snapshot);if(key===lastFingerprint)return;
      await run(async()=>{
        try{
          const payload=session.password?await root.SalaryMateBackup.encrypt(snapshot,session.password):snapshot;
          if(auto!==session||!client.status().connected)throw new Error('Google 連線已取消。');
          const file=await client.upload(payload,nameForBackup());
          lastSaved=new Date().toISOString();lastFingerprint=key;files=[file,...files];message='備份已儲存至自己的 Google Drive';renderFiles();
          if(auto===session&&fingerprint(api.snapshot())!==key)changed();
        }catch(error){stopAuto(false);throw error;}
      });
    }
    function rename(file){
      api.openDialog('編輯雲端備份名稱',`<form id="googleDriveRename"><label><span class="field-label">備份名稱</span><input class="field" name="name" value="${esc(file.name)}" maxlength="160" required></label><p class="drive-status" role="status"></p><div class="form-actions"><button class="btn" type="button" data-drive-action="back">返回</button><button class="btn btn-primary" type="submit">儲存</button></div></form>`);
      const form=$('#googleDriveRename');form.addEventListener('submit',async event=>{event.preventDefault();if(busy||!form.reportValidity())return;const result=await run(async()=>{const updated=await client.rename(file.id,form.elements.name.value);files=files.map(f=>f.id===file.id?updated:f);message='雲端備份名稱已更新';return true;});if(active(form)){if(result)open();else form.querySelector('[role="status"]').textContent=text(message);}});
    }
    root.document.addEventListener('click',event=>{
      const button=event.target.closest?.('[data-drive-action]');if(!button||button.disabled)return;
      const action=button.dataset.driveAction,file=files.find(f=>f.id===button.dataset.id);
      if(action==='connect')return run(async()=>{await client.connect();await refresh();});
      if(action==='disconnect'){client.disconnect();message='已中斷連線，雲端備份仍保留';open();return;}
      if(action==='revoke'){api.confirm('撤銷 Google 授權','停止本工具的 Google Drive 存取；已存放的雲端備份與本機資料仍保留。',()=>run(async()=>{await client.revoke();message='Google 授權已撤銷';open();}),'撤銷授權');return;}
      if(action==='clear-config'){api.confirm('刪除連線設定','移除此瀏覽器的 Google 用戶端 ID 並停止自動儲存；雲端備份與本機資料仍保留。',()=>{client.configure('');message='連線設定已刪除';open();},'刪除');return;}
      if(action==='refresh'||action==='more')return run(()=>refresh(action==='more'));
      if(action==='save'||action==='auto'){openSave(action);return;}
      if(action==='stop-auto'){stopAuto();return;}
      if(action==='back'){open();return;}
      if(action==='rename'&&file){rename(file);return;}
      if(action==='trash'&&file){api.confirm('刪除雲端備份',file.name+'\n這份備份將移到 Google Drive 垃圾桶，本機資料不受影響。',()=>run(async()=>{await client.trash(file.id);files=files.filter(f=>f.id!==file.id);message='雲端備份已移到垃圾桶';open();}),'刪除');return;}
      if(action==='restore'&&file){const p=panel(),serial=panelSerial;return run(async()=>{const backup=await client.download(file.id);if(!active(p)||serial!==panelSerial||!client.status().connected)return;stopAuto(false);api.closeDialog();await api.importFile(backup);});}
    });
    root.addEventListener('pagehide',()=>{stopAuto(false);client.disconnect();});
    root.addEventListener('storage',event=>{if(event.key==='salarymate_v5_google_client_id'){client.disconnect();message='Google 連線設定已變更，請重新連線。';refreshStatus();}});
    return Object.freeze({open,changed,stopAuto,summary});
  }
  root.SalaryMateGoogleDriveUI=Object.freeze({create});
})(globalThis);
