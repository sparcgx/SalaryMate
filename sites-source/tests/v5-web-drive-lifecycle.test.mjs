import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const {JSDOM}=await import(process.env.SALARYMATE_DOM_MODULE||'/tmp/salarymate-v5-qa/node_modules/jsdom/lib/api.js');
const base=new URL('../dist/dev/v5.0.0-dev.2/',import.meta.url);
const source=fs.readFileSync(new URL('google-drive.js',base),'utf8');
const uiSource=fs.readFileSync(new URL('google-drive-ui.js',base),'utf8');
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const until=async fn=>{for(let i=0;i<30&&!fn();i++)await tick();assert.ok(fn(),'Synthetic operation must settle');};
const file={id:'fixture_file',name:'fixture.json',size:'2',mimeType:'application/json',ownedByMe:true,trashed:false,appProperties:{salarymate:'salarymate-v5-backup',encrypted:'false'}};
function driveFixture(fetch){
 const timers=new Map(),auth=[],storage=new Map(),scripts=[];let serial=0;
 const c={URL,URLSearchParams,AbortController,TextEncoder,TextDecoder,Uint8Array,Date,
  location:{protocol:'https:',hostname:'fixture.test'},navigator:{onLine:true},
  localStorage:{getItem:k=>storage.get(k)||'',setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
  SalaryMateBackup:{isEncrypted:()=>false},
  setTimeout:(fn,ms)=>{const id=++serial;timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),fetch,
  document:{createElement:()=>({remove(){this.removed=true;}}),head:{append:s=>scripts.push(s)}},
  google:{accounts:{oauth2:{hasGrantedAllScopes:()=>true,initTokenClient:options=>({requestAccessToken(){auth.push(options);}})}}}};
 vm.createContext(c);vm.runInContext(source,c);const client=c.SalaryMateGoogleDrive.createClient();client.configure('123-fixture.apps.googleusercontent.com');
 return {c,client,auth,timers,scripts,response:()=>({access_token:'synthetic-token',expires_in:3600}),fire(ms){const entry=[...timers].find(([,t])=>t.ms===ms);assert.ok(entry,`Missing ${ms}ms timer`);timers.delete(entry[0]);entry[1].fn();},async connect(){const pending=client.connect();await auth.at(-1).callback(this.response());await pending;}};
}

test('Web GIS timeout cleans handlers; a late old error cannot break or duplicate the retry',async()=>{
 const h=driveFixture(async()=>{throw Error('No network expected');});delete h.c.google;
 const first=h.c.SalaryMateGoogleDrive.loadIdentity(),rejected=assert.rejects(first);
 const lateError=h.scripts[0].onerror;h.fire(15000);await rejected;
 assert.equal(h.scripts[0].onerror,null);assert.equal(h.scripts[0].onload,null);assert.equal(h.scripts[0].removed,true);
 const second=h.c.SalaryMateGoogleDrive.loadIdentity();lateError();
 assert.equal(h.c.SalaryMateGoogleDrive.loadIdentity(),second);assert.equal(h.scripts.length,2);
 h.c.google={accounts:{oauth2:{}}};h.scripts[1].onload();await second;
 assert.equal(h.scripts[1].onerror,null);assert.equal(h.timers.size,0);
});

test('Web GIS explains offline state and can retry after offline or synchronous insertion failure',async()=>{
 const h=driveFixture(async()=>{});delete h.c.google;h.c.navigator.onLine=false;
 await assert.rejects(h.c.SalaryMateGoogleDrive.loadIdentity(),/離線/);assert.equal(h.scripts.length,0);
 h.c.navigator.onLine=true;const append=h.c.document.head.append;h.c.document.head.append=()=>{throw Error('blocked');};
 await assert.rejects(h.c.SalaryMateGoogleDrive.loadIdentity(),/載入失敗/);assert.equal(h.timers.size,0);
 h.c.document.head.append=append;const retry=h.c.SalaryMateGoogleDrive.loadIdentity();assert.equal(h.scripts.length,1);
 h.c.google={accounts:{oauth2:{}}};h.scripts[0].onload();await retry;
});

test('Late cancelled account lookup cannot disconnect a newer successful OAuth session',async()=>{
 const oldBody=deferred();let count=0;
 const h=driveFixture(async()=>++count===1?{ok:true,status:200,json:()=>oldBody.promise}:Response.json({user:{permissionId:'new-account'}}));
 const oldConnect=h.client.connect(),rejected=assert.rejects(oldConnect);const oldCallback=h.auth[0].callback(h.response());await tick();
 h.client.disconnect();await rejected;await h.connect();assert.equal(h.client.status().user.permissionId,'new-account');
 oldBody.resolve({user:{permissionId:'old-account'}});await oldCallback;await tick();
 assert.equal(h.client.status().connected,true);assert.equal(h.client.status().user.permissionId,'new-account');h.client.disconnect();
});

test('OAuth timeout clears tentative credentials and ignores late success while allowing a new attempt',async()=>{
 const about=deferred();let first=true;
 const h=driveFixture(async()=>first?{ok:true,status:200,json:()=>about.promise}:Response.json({user:{permissionId:'retry-account'}}));
 const pending=h.client.connect(),rejected=assert.rejects(pending);const callback=h.auth[0].callback(h.response());await tick();
 h.fire(120000);await rejected;assert.equal(h.client.status().connected,false);assert.equal(h.client.status().user,null);
 about.resolve({user:{permissionId:'late-account'}});await callback;await tick();assert.equal(h.client.status().connected,false);
 first=false;await h.connect();assert.equal(h.client.status().user.permissionId,'retry-account');h.client.disconnect();
});

test('Drive download covers body reads with timeout and disconnect, cancels the reader and permits retry',async()=>{
 for(const cause of ['timeout','disconnect']){
  const chunk=deferred();let signal,readStarted=false,cancelled=0,stalled=true;
  const h=driveFixture(async(url,init)=>{
   const u=new URL(url);if(u.pathname.endsWith('/about'))return Response.json({user:{permissionId:'account'}});
   if(u.pathname.endsWith('/files'))return Response.json({files:[file]});
   if(!u.searchParams.has('alt'))return Response.json(file);
   if(!stalled)return new Response('{}');
   signal=init.signal;return {ok:true,status:200,headers:new Headers(),body:{getReader:()=>({read(){readStarted=true;return chunk.promise;},cancel:async()=>{cancelled++;}})}};
  });
  await h.connect();await h.client.list();const pending=h.client.download(file.id),rejected=assert.rejects(pending);
  await until(()=>readStarted);assert.ok([...h.timers.values()].some(t=>t.ms===60000));
  if(cause==='timeout')h.fire(60000);else h.client.disconnect();await rejected;
  assert.equal(signal.aborted,true);assert.ok(cancelled>0);assert.ok(![...h.timers.values()].some(t=>t.ms===60000));
  chunk.resolve({done:true});stalled=false;if(cause==='disconnect')await h.connect();await h.client.list();
  assert.equal(await (await h.client.download(file.id)).text(),'{}');h.client.disconnect();
 }
});

test('A completed upload body from an old account cannot report success after disconnect',async()=>{
 const body=deferred();let reading=false;
 const h=driveFixture(async(url,init)=>{
  const u=new URL(url);if(u.pathname.endsWith('/about'))return Response.json({user:{permissionId:'account'}});
  if(u.pathname.startsWith('/upload/')){
   if(init.method==='POST')return new Response('',{headers:{Location:'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable'}});
   return {ok:true,status:200,json:()=>{reading=true;return body.promise;}};
  }
  return Response.json({files:[{id:'folder'}]});
 });
 await h.connect();const upload=h.client.upload({companies:[],records:[]},'fixture'),rejected=assert.rejects(upload);
 await until(()=>reading);h.client.disconnect();await rejected;assert.equal(h.client.status().busy,false);
 body.resolve(file);await tick();assert.equal(h.client.status().connected,false);assert.equal(h.client.status().user,null);
});

test('Drive download returns measured UTF-8 byte size without re-encoding a streamed backup',async()=>{
 const text='{"name":"測試"}',bytes=new TextEncoder().encode(text);
 for(const streamed of [true,false]){
  let encodes=0;
  const h=driveFixture(async url=>{
   const u=new URL(url);if(u.pathname.endsWith('/about'))return Response.json({user:{permissionId:'account'}});
   if(u.pathname.endsWith('/files'))return Response.json({files:[file]});
   if(!u.searchParams.has('alt'))return Response.json(file);
   return streamed?new Response(bytes):{ok:true,status:200,headers:new Headers(),text:async()=>text};
  });
  h.c.TextEncoder=class extends TextEncoder{encode(value){encodes++;return super.encode(value);}};
  await h.connect();await h.client.list();const downloaded=await h.client.download(file.id);
  assert.equal(downloaded.size,bytes.length);assert.equal(await downloaded.text(),text);assert.equal(encodes,streamed?0:1);h.client.disconnect();
 }
});

function uiFixture({identity=async()=>{},connected=true,upload=async()=>file,snapshot=()=>({companies:[],records:[],uiPreferences:{}})}={}){
 const dom=new JSDOM('<dialog id="appDialog" open></dialog>',{url:'https://fixture.test',runScripts:'outside-only'}),w=dom.window;
 const timers=new Map();let serial=0,uploads=0,identityCalls=0;
 w.localStorage.setItem('salarymate_v5_full_state','unchanged-fixture');
 const client={status:()=>({connected,busy:false,user:connected?{permissionId:'account',emailAddress:'fixture@example.test'}:null}),clientId:()=> '123-fixture.apps.googleusercontent.com',upload:(...args)=>{uploads++;return upload(...args);},disconnect(){connected=false;}};
 w.setTimeout=(fn,ms)=>{const id=++serial;timers.set(id,{fn,ms});return id;};w.clearTimeout=id=>timers.delete(id);
 w.SalaryMateGoogleDrive={supported:()=>true,validClientId:()=>true,loadIdentity:()=>{identityCalls++;return identity();},createClient:()=>client};
 w.SalaryMateBackup={encrypt:async data=>data};w.eval(uiSource);
 const api=w.SalaryMateGoogleDriveUI.create({escapeHtml:String,snapshot,toast(){},openDialog(title,html){const dialog=w.document.querySelector('#appDialog');dialog.innerHTML=html;dialog.open=true;}});
 const q=s=>w.document.querySelector(s);
 return {dom,w,api,timers,q,client,get uploads(){return uploads;},get identityCalls(){return identityCalls;},close(){api.stopAuto(false);assert.equal(w.localStorage.getItem('salarymate_v5_full_state'),'unchanged-fixture');dom.window.close();}};
}

test('Drive UI shows loader failure and an immediate retry; pending retry cannot be duplicated',async()=>{
 const retry=deferred();let count=0;const h=uiFixture({connected:false,identity:()=>++count===1?Promise.reject(Error('fixture identity failed')):retry.promise});
 h.api.open();await tick();assert.match(h.q('[data-drive-message]').textContent,/fixture identity failed/);
 const button=h.q('[data-drive-action="retry-identity"]');assert.equal(button.hidden,false);assert.equal(h.q('[data-drive-action="connect"]').disabled,true);
 button.click();button.click();assert.equal(h.identityCalls,2);assert.match(h.q('[data-drive-message]').textContent,/載入/);
 retry.resolve();await tick();assert.equal(button.hidden,true);assert.equal(h.q('[data-drive-action="connect"]').disabled,false);h.close();
});

test('Auto setup deduplicates submissions and only activates if its form is still open after upload',async()=>{
 for(const cancel of [false,true])for(const encrypted of [false,true]){
  const pending=deferred(),h=uiFixture({upload:()=>pending.promise});h.api.open();h.q('[data-drive-action="auto"]').click();
  const form=h.q('#googleDriveSave');if(encrypted){form.elements.encrypted.checked=true;form.elements.encrypted.dispatchEvent(new h.w.Event('change'));form.elements.password.value=form.elements.confirmation.value='fixture-password';}
  const submit=()=>form.dispatchEvent(new h.w.Event('submit',{cancelable:true,bubbles:true}));submit();submit();await until(()=>h.uploads===1);
  if(cancel){h.q('#appDialog').open=false;form.remove();}
  pending.resolve(file);await tick();assert.equal(h.uploads,1);
  assert.equal([...h.timers.values()].some(t=>t.ms===10000),!cancel);assert.equal(h.api.summary().includes('自動儲存已開啟'),!cancel);
  assert.equal(form.elements.password.value,'');h.close();
 }
});

test('Drive save reports a snapshot failure, releases busy state and permits exactly one retried upload',async()=>{
 const pending=deferred();let fail=true,snapshots=0;
 const h=uiFixture({upload:()=>pending.promise,snapshot:()=>{snapshots++;if(fail)throw Error('fixture snapshot unavailable');return {companies:[],records:[]};}});
 h.api.open();h.q('[data-drive-action="save"]').click();const form=h.q('#googleDriveSave');
 const submit=()=>form.dispatchEvent(new h.w.Event('submit',{cancelable:true,bubbles:true}));submit();submit();await tick();
 assert.equal(snapshots,1);assert.equal(h.uploads,0);assert.match(form.querySelector('[role="status"]').textContent,/fixture snapshot unavailable/);assert.equal(form.querySelector('[type="submit"]').disabled,false);
 fail=false;submit();submit();await until(()=>h.uploads===1);pending.resolve(file);await tick();
 assert.equal(h.uploads,1);assert.equal(snapshots,2);assert.ok(h.q('#googleDrivePanel'));h.close();
});
