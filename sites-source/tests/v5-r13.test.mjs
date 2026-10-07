import test from 'node:test';
import assert from 'node:assert/strict';
import {boot,fixture} from './helpers/v5-full-dom.mjs';
const CLIENT='123456789-test.apps.googleusercontent.com',SCOPE='https://www.googleapis.com/auth/drive.file';
const tick=()=>new Promise(r=>setTimeout(r,5));
const until=async fn=>{for(let i=0;i<300&&!fn();i++)await tick();assert.ok(fn(),'Async operation did not settle');};
function google(b,options={}){
  const sent=[],remote=new Map();let cfg,serial=0,requestFailure=null,account='owner-a',location='https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=session',pending;
  const meta=(id,name='backup.json',extra={})=>({id,name,modifiedTime:new Date().toISOString(),size:'100',mimeType:'application/json',ownedByMe:true,trashed:false,appProperties:{salarymate:'salarymate-v5-backup',encrypted:'false'},...extra});
  b.w.google={accounts:{oauth2:{initTokenClient:c=>(cfg=c,{requestAccessToken:()=>{assert.equal(c.scope,SCOPE);assert.equal(c.include_granted_scopes,false);queueMicrotask(()=>c.callback({access_token:'memory-only-token',expires_in:3600,scope:options.denied?'':SCOPE}));}}),hasGrantedAllScopes:r=>r.scope===SCOPE,revoke:(token,cb)=>{assert.equal(token,'memory-only-token');cb({successful:true});}}}};
  b.w.fetch=async(url,init={})=>{
    sent.push({url,init});assert.equal(new URL(url).origin,'https://www.googleapis.com');assert.equal(init.credentials,'omit');assert.equal(init.redirect,'error');assert.equal(init.headers.Authorization,'Bearer memory-only-token');
    if(requestFailure){const {code,payload}=requestFailure;requestFailure=null;return new Response(JSON.stringify(payload),{status:code});}
    const u=new URL(url),method=init.method||'GET',json=v=>new Response(JSON.stringify(v),{headers:{'Content-Type':'application/json'}});
    if(u.pathname.endsWith('/about'))return json({user:{emailAddress:account+'@example.com',displayName:'Owner',permissionId:account}});
    if(u.pathname.startsWith('/upload/')){
      if(method==='POST'){pending=JSON.parse(init.body);return new Response('',{headers:{Location:location}});}
      if(method==='PUT'){const value=JSON.parse(new TextDecoder().decode(init.body)),id='f'+(++serial),file=meta(id,pending.name,{appProperties:pending.appProperties,size:String(init.body.byteLength)});remote.set(id,{file,value});return json(file);}
    }
    if(u.pathname.endsWith('/files')){
      if(method==='POST')return json({id:'folder1'});
      if(u.searchParams.get('q').includes('salarymate-v5-folder'))return json({files:[{id:'folder1'}]});
      return json({files:[...remote.values()].map(r=>r.file).filter(f=>!f.trashed),nextPageToken:''});
    }
    const id=u.pathname.split('/').pop(),entry=remote.get(id);if(!entry)return new Response('{}',{status:404});
    if(method==='PATCH'){Object.assign(entry.file,JSON.parse(init.body));return json(entry.file);}
    return json(u.searchParams.get('alt')==='media'?entry.value:entry.file);
  };
  return {sent,remote,get config(){return cfg;},failure:(code,payload={})=>requestFailure={code,payload},badLocation:()=>location='https://evil.example/upload',account:id=>account=id,add:(id,value,extra)=>remote.set(id,{file:meta(id,undefined,extra),value})};
}
const drive=(b,a)=>b.click(`[data-drive-action="${a}"]`);
async function connect(b){b.tab('settings');b.click('[data-action="open-google-drive"]');b.change('#googleDriveConfig [name="clientId"]',CLIENT);b.submit('#googleDriveConfig');await tick();drive(b,'connect');await until(()=>b.q('[data-drive-message]')?.textContent.includes('清單已更新'));}

test('R13 privacy: no Drive traffic before user intent; OAuth is narrow, token stays in memory and account is shown',async()=>{
  const b=boot(fixture()),g=google(b);assert.equal(g.sent.length,0);assert.equal(b.q('script[src="https://accounts.google.com/gsi/client"]'),null);
  await connect(b);assert.match(b.q('[data-drive-account]').textContent,/owner-a/);assert.equal(g.sent.length,2);
  const stored=Object.keys(b.w.localStorage).map(k=>b.w.localStorage.getItem(k)).join();assert.ok(!stored.includes('memory-only-token'));assert.ok(!b.w.SalaryMateData.exportPayload().includes(CLIENT));
  drive(b,'disconnect');assert.match(b.q('[data-drive-account]').textContent,/尚未連線/);assert.equal(g.remote.size,0);assert.deepEqual(b.errors,[]);b.close();
});
test('R13 Drive CRUD and restore: upload directly, preserve immutable versions, rename/trash, preview merge without modifying local data',async()=>{
  const b=boot(fixture()),g=google(b);await connect(b);const before=b.raw();
  drive(b,'save');b.submit('#googleDriveSave');await until(()=>g.remote.size===1&&!!b.q('#googleDrivePanel'));assert.equal(b.raw(),before);
  assert.equal(g.remote.get('f1').value.records.length,3);assert.equal(g.remote.get('f1').file.appProperties.encrypted,'false');
  drive(b,'save');b.submit('#googleDriveSave');await until(()=>g.remote.size===2&&!!b.q('#googleDrivePanel'));
  drive(b,'rename');b.change('#googleDriveRename [name="name"]','Renamed.json');b.submit('#googleDriveRename');await until(()=>!!b.q('#googleDrivePanel'));assert.equal(g.remote.get('f2').file.name,'Renamed.json');
  drive(b,'restore');await until(()=>!!b.q('#backupImportForm'));assert.equal(b.raw(),before);b.click('[data-action="close-dialog"]');b.click('[data-action="open-google-drive"]');
  drive(b,'trash');b.click('[data-action="confirm-action"]');await until(()=>!!b.q('#googleDrivePanel'));assert.equal(g.remote.get('f2').file.trashed,true);assert.equal(b.raw(),before);assert.equal(b.q('[data-drive-action="restore"][data-id="f2"]'),null);
  const writes=g.sent.filter(r=>['POST','PUT','PATCH'].includes(r.init.method));assert.ok(writes.length>5);assert.ok(writes.every(r=>new URL(r.url).hostname==='www.googleapis.com'));assert.deepEqual(b.errors,[]);b.close();
});
test('R13 encrypted upload: password never sent or persisted; wrong-password restore leaves local data intact',async()=>{
  const b=boot(fixture()),g=google(b);await connect(b);drive(b,'save');b.click('#googleDriveSave [name="encrypted"]');b.change('#googleDriveSave [name="password"]','secret-password-123');b.change('#googleDriveSave [name="confirmation"]','secret-password-123');b.submit('#googleDriveSave');await until(()=>g.remote.size===1&&!!b.q('#googleDrivePanel'));
  const record=g.remote.get('f1');assert.equal(record.value.format,'salarymate-encrypted-backup');assert.equal(record.file.appProperties.encrypted,'true');assert.ok(!JSON.stringify(record.value).includes('甲公司'));assert.ok(!b.raw().includes('secret-password'));assert.ok(!JSON.stringify(g.sent).includes('secret-password'));
  const restored=await b.w.SalaryMateBackup.decrypt(record.value,'secret-password-123');assert.equal(restored.records.length,3);const before=b.raw();drive(b,'restore');await until(()=>!!b.q('#backupDecryptForm'));b.change('#backupDecryptForm [name="password"]','wrong-password');b.submit('#backupDecryptForm');await until(()=>b.q('.backup-status').textContent.includes('密碼不正確'));assert.equal(b.raw(),before);assert.deepEqual(b.errors,[]);b.close();
});
test('R13 auto-save is session-only, debounces real changes, stops after auth loss, and never overwrites cloud files',async()=>{
  const b=boot(fixture()),g=google(b);await connect(b);const native=b.w.setTimeout.bind(b.w);b.w.setTimeout=(fn,ms,...args)=>native(fn,ms===10000?15:ms,...args);
  drive(b,'auto');b.submit('#googleDriveSave');await until(()=>g.remote.size===1&&!!b.q('#googleDrivePanel'));assert.match(b.q('[data-drive-session]').textContent,/本次開啟期間自動儲存/);
  b.w.SalaryMateCloud.changed();b.w.SalaryMateCloud.changed();await new Promise(r=>setTimeout(r,50));assert.equal(g.remote.size,1);
  const original=b.w.SalaryMateData.exportPayload;let delta=1;b.w.SalaryMateData={...b.w.SalaryMateData,exportPayload:()=>{const p=JSON.parse(original());p.records[0].baseSalary+=delta;return JSON.stringify(p);}};
  b.w.SalaryMateCloud.changed();await until(()=>g.remote.size===2);assert.equal(g.remote.get('f1').value.records[0].baseSalary,48000);assert.equal(g.remote.get('f2').value.records[0].baseSalary,48001);
  g.failure(401);delta=2;b.w.SalaryMateCloud.changed();await until(()=>b.q('[data-drive-session]').textContent.includes('未開啟'));assert.equal(g.remote.size,2);delta=3;b.w.SalaryMateCloud.changed();await new Promise(r=>setTimeout(r,50));assert.equal(g.remote.size,2);assert.deepEqual(b.errors,[]);b.close();
});
test('R13 application integration: successful company edits trigger auto backup through the existing storage hook',async()=>{
  const b=boot(fixture()),g=google(b);await connect(b);const native=b.w.setTimeout.bind(b.w);b.w.setTimeout=(fn,ms,...args)=>native(fn,ms===10000?20:ms,...args);
  drive(b,'auto');b.submit('#googleDriveSave');await until(()=>g.remote.size===1&&!!b.q('#googleDrivePanel'));b.click('[data-action="close-dialog"]');b.click('[data-action="add-company-basic"]');b.change('#companyBasicForm [name="name"]','Third company');b.change('#companyBasicForm [name="baseSalary"]','45000');b.change('#companyBasicForm [name="employmentStartDate"]','2026-01-01');b.submit('#companyBasicForm');await until(()=>g.remote.size===2);assert.equal(g.remote.get('f2').value.companies.length,3);assert.equal(g.remote.get('f1').value.companies.length,2);assert.deepEqual(b.errors,[]);b.close();
});
test('R13 auth and endpoint safeguards: denied grant, unexpected upload host, missing files and 403 cannot send a backup or change local data',async()=>{
  const a=boot(fixture()),denied=google(a,{denied:true});a.tab('settings');a.click('[data-action="open-google-drive"]');a.change('#googleDriveConfig [name="clientId"]',CLIENT);a.submit('#googleDriveConfig');await tick();drive(a,'connect');await until(()=>a.q('[data-drive-message]').textContent.includes('尚未授予'));assert.equal(denied.sent.length,0);a.close();
  const b=boot(fixture()),g=google(b);await connect(b);const before=b.raw();g.badLocation();drive(b,'save');b.submit('#googleDriveSave');await until(()=>b.q('#googleDriveSave [role="status"]').textContent.includes('已阻止'));assert.equal(g.remote.size,0);assert.ok(!g.sent.some(r=>r.init.method==='PUT'));assert.equal(b.raw(),before);drive(b,'back');g.failure(403);drive(b,'refresh');await until(()=>b.q('[data-drive-message]').textContent.includes('拒絕存取'));assert.equal(b.raw(),before);assert.deepEqual(b.errors,[]);b.close();
});
test('R13 cloud list treats names as text; revoke clears session and changing settings never uploads local data',async()=>{
  const b=boot(fixture()),g=google(b);g.add('external',fixture(),{name:'<img src=x onerror=alert(1)>.json'});await connect(b);assert.equal(b.q('.drive-files img'),null);assert.match(b.q('.drive-files').textContent,/<img/);
  drive(b,'revoke');b.click('[data-action="confirm-action"]');await until(()=>!!b.q('#googleDrivePanel'));assert.match(b.q('[data-drive-account]').textContent,/尚未連線/);assert.equal(g.remote.size,1);
  drive(b,'clear-config');b.click('[data-action="confirm-action"]');assert.equal(b.w.localStorage.getItem('salarymate_v5_google_client_id'),null);assert.equal(g.remote.size,1);assert.deepEqual(b.errors,[]);b.close();
});
test('R13 local file edition gives an actionable Google origin requirement and keeps offline backups working',{skip:!process.env.SALARYMATE_SINGLE_HTML},async()=>{
  const b=boot(fixture(),{url:'file:///SalaryMate.html'}),g=google(b);b.tab('settings');b.click('[data-action="open-google-drive"]');assert.equal(b.q('[data-drive-action="connect"]').disabled,true);assert.match(b.q('#googleDrivePanel').textContent,/HTTPS 網站或 localhost/);assert.equal(g.sent.length,0);b.click('[data-action="close-dialog"]');b.click('[data-action="export-json"]');b.submit('#backupExportForm');await until(()=>b.downloads.length===1);assert.deepEqual(b.errors,[]);b.close();
});
test('R13 English: cloud setup and save forms are translated without changing stored business data',async()=>{
  const b=boot(fixture()),g=google(b);await connect(b);b.click('[data-language="en"]');b.w.SalaryMateI18n.apply();assert.equal(b.q('#dialogTitle').textContent,'My Google Drive');
  assert.ok(!/[\u3400-\u9fff]/.test(b.q('#googleDrivePanel').textContent),b.q('#googleDrivePanel').textContent.match(/[^.]{0,30}[\u3400-\u9fff][^.]{0,30}/)?.[0]);drive(b,'save');b.w.SalaryMateI18n.apply();assert.ok(!/[\u3400-\u9fff]/.test(b.q('#googleDriveSave').textContent));assert.equal(b.state().companies[0].name,'甲公司');assert.equal(g.remote.size,0);assert.deepEqual(b.errors,[]);b.close();
});

test('R14 Google 403 explains exact step and service-disabled code, without exposing response message or changing local data',async()=>{
  const b=boot(fixture()),g=google(b),before=b.raw();b.tab('settings');b.click('[data-action="open-google-drive"]');b.change('#googleDriveConfig [name="clientId"]',CLIENT);b.submit('#googleDriveConfig');await tick();
  g.failure(403,{error:{message:'PRIVATE response text <script>secret</script>',details:[{'@type':'type.googleapis.com/google.rpc.ErrorInfo',reason:'SERVICE_DISABLED'}]}});
  drive(b,'connect');await until(()=>b.q('[data-drive-message]').textContent.includes('SERVICE_DISABLED'));
  const diagnostic=b.q('[data-drive-message]').textContent;
  assert.match(diagnostic,/確認 Google 帳戶失敗/);assert.match(diagnostic,/同一個專案啟用 API/);
  assert.ok(!diagnostic.includes('PRIVATE'));assert.ok(!diagnostic.includes('secret'));assert.ok(!b.raw().includes('SERVICE_DISABLED'));
  assert.equal(g.sent.length,1);assert.equal(g.remote.size,0);assert.equal(b.raw(),before);assert.deepEqual(b.errors,[]);b.close();
});

test('R14 Google 403 distinguishes scope, storage and unknown reasons while leaving backups unchanged',async()=>{
  const b=boot(fixture()),g=google(b);await connect(b);const before=b.raw();
  g.failure(403,{error:{errors:[{reason:'insufficientPermissions',message:'never display this text'}]}});
  drive(b,'refresh');await until(()=>b.q('[data-drive-message]').textContent.includes('insufficientPermissions'));
  assert.match(b.q('[data-drive-message]').textContent,/讀取備份清單失敗/);assert.match(b.q('[data-drive-message]').textContent,/drive.file/);
  assert.ok(!b.q('[data-drive-message]').textContent.includes('never display'));
  const original=b.w.fetch;b.w.fetch=(url,init)=>init?.method==='POST'&&new URL(url).pathname.endsWith('/drive/v3/files')
    ?new Response(JSON.stringify({error:{errors:[{reason:'storageQuotaExceeded'}]}}),{status:403}):original(url,init);
  drive(b,'save');b.submit('#googleDriveSave');await until(()=>b.q('#googleDriveSave [role="status"]').textContent.includes('storageQuotaExceeded'));
  assert.match(b.q('#googleDriveSave [role="status"]').textContent,/建立備份上傳失敗/);
  assert.match(b.q('#googleDriveSave [role="status"]').textContent,/雲端容量不足/);
  assert.equal(g.remote.size,0);assert.equal(b.raw(),before);
  b.w.fetch=original;drive(b,'back');g.failure(403,{error:{errors:[{reason:'<img src=x onerror=alert(1)>',message:'secret'}]}});
  drive(b,'refresh');await until(()=>b.q('[data-drive-message]').textContent.includes('未提供'));
  assert.equal(b.q('[data-drive-message] img'),null);assert.ok(!b.q('[data-drive-message]').textContent.includes('secret'));
  assert.equal(b.raw(),before);assert.deepEqual(b.errors,[]);b.close();
});
