import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {createUpdateService,releaseInfo,version,compare,downloadVerified,downloadURL,REPO,RELEASES,MAX_INSTALLER}=require('../native-desktop/src/updates.cjs');
const digest=bytes=>createHash('sha256').update(bytes).digest('hex'),bytes=Buffer.from('MZ SalaryMate test fixture only');
const release=(tag='v5.0.0-desktop.6',osName='win',arch='x64',body=bytes)=>{
 const v=version(tag).slice(0,3).join('.'),name=`SalaryMate_v${v}_${osName}_${arch}.${osName==='win'?'exe':'dmg'}`;
 return {tag_name:tag,draft:false,prerelease:false,html_url:REPO+'/releases/tag/'+tag,published_at:'2026-10-19T12:00:00Z',body:'Update notes <script>no execution</script>',assets:[{name,state:'uploaded',browser_download_url:REPO+'/releases/download/'+tag+'/'+name,size:body.length,digest:'sha256:'+digest(body)}]};
};
const asset=releaseInfo(release(),'win32','x64').asset;
const backup=JSON.stringify({schemaVersion:15,companies:[],records:[],overtimeLogs:[],leaveRecords:[],investmentRecords:[],compTimeCredits:[],compTimeSettlements:[],yearEndEstimates:[],salaryAdjustments:[],stockPortfolio:{assets:[],transactions:[]}});
async function temp(t){const dir=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),'salarymate-updates-')));t.after(()=>fs.rm(dir,{recursive:true,force:true}));return dir;}
async function fixture(t,overrides={}){
 const dir=await temp(t),destination=path.join(dir,asset.name);let requests=[],opened=[],quit=0,confirm=1,save={ok:true,verified:true,fileName:'backup.json'};
 const config={userData:path.join(dir,'profile'),currentTag:'v5.0.0-desktop.5',build:5000107,platform:'win32',arch:'x64',parent:()=>null,dialog:{showSaveDialog:async()=>({filePath:destination}),showMessageBox:async()=>({response:confirm})},fetcher:async(url,options)=>{requests.push({url,options});return url===RELEASES?Response.json([release()]):new Response(bytes);},saveBackup:async()=>save,openPath:async file=>{opened.push(file);return '';},showItemInFolder:()=>{},quit:()=>quit++,...overrides};
 const service=createUpdateService(config);
 return {service,dir,destination,config,requests,opened,quits:()=>quit,setConfirm:n=>{confirm=n;},setSave:n=>{save=n;}};
}
test('desktop comparison uses semantic version then package number and rejects non-desktop/prerelease tags',()=>{
 for(const tag of ['v5.0.0-R101','v5.0.0-dev.2-R101-android','v5.0.0-desktop.0','v05.0.0-desktop.6','v5.0.0-desktop.6-beta'])assert.equal(version(tag),null);
 assert.equal(compare('v5.0.0-desktop.10','v5.0.0-desktop.9'),1);assert.equal(compare('v5.1.0-desktop.1','v5.0.0-desktop.99'),1);assert.equal(compare('v5.0.0-desktop.5','v5.0.0-desktop.5'),0);
});
test('release selection binds exact repository, platform, filename, size and SHA-256',()=>{
 const mac=release('v5.0.0-desktop.6','mac','arm64');assert.match(releaseInfo(mac,'darwin','arm64').asset.name,/mac_arm64.dmg$/);assert.equal(releaseInfo(mac,'win32','x64').asset,null);
 for(const edit of [{draft:true},{prerelease:true},{html_url:'https://github.com/evil/SalaryMate/releases/tag/v5.0.0-desktop.6'},{published_at:'no date'}])assert.equal(releaseInfo({...release(),...edit},'win32','x64'),null);
 for(const patch of [{size:MAX_INSTALLER+1},{size:0},{digest:null},{state:'new'},{browser_download_url:'https://evil.test/run.exe'}]){const r=release();Object.assign(r.assets[0],patch);assert.equal(releaseInfo(r,'win32','x64').asset,null);}
 const duplicate=release();duplicate.assets.push(duplicate.assets[0]);assert.equal(releaseInfo(duplicate,'win32','x64').asset,null);
});
test('updater is inert at startup and selects newest formal desktop release without sending private data',async t=>{
 const f=await fixture(t,{fetcher:async(url,options)=>{assert.equal(url,RELEASES);assert.equal(options.method,undefined);assert.equal(options.body,undefined);assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');return Response.json([release('v5.0.0-desktop.4'),{...release('v9.0.0-desktop.1'),prerelease:true},release('v5.0.0-desktop.7'),release('v5.0.0-desktop.6')]);}});
 assert.equal((await f.service.state()).latest,null);const checked=await f.service.check();assert.equal(checked.latest.tag,'v5.0.0-desktop.7');assert.equal(checked.canDownload,true);
 const old=await fixture(t,{currentTag:'v6.0.0-desktop.1'});assert.equal((await old.service.check()).available,false);await assert.rejects(old.service.download(),e=>e.code==='UPDATE_CHECK_REQUIRED');
});
test('cached results are marked stale on restart; ETag 304 refreshes without losing notes or architecture',async t=>{
 const f=await fixture(t,{fetcher:async()=>Response.json([release()],{headers:{etag:'"test"'}})});await f.service.check();
 let calls=0;const reopened=createUpdateService({...f.config,fetcher:async(url,o)=>{calls++;assert.equal(o.headers['If-None-Match'],'"test"');return new Response(null,{status:304});}});
 assert.equal((await reopened.state()).fresh,false);assert.equal(calls,0);assert.equal((await reopened.check()).fresh,true);assert.equal(calls,1);assert.match((await reopened.state()).latest.notes,/Update notes/);
});
test('offline, rate limiting and malformed metadata retain the last result and block stale downloads',async t=>{
 let fail=false;const f=await fixture(t,{fetcher:async()=>fail?new Response('',{status:429}):Response.json([release()])});await f.service.check();fail=true;
 await assert.rejects(f.service.check(),e=>e.code==='UPDATE_RATE_LIMIT');const s=await f.service.state();assert.equal(s.fresh,false);assert.equal(s.latest.tag,'v5.0.0-desktop.6');assert.equal(s.canDownload,false);
 const bad=await fixture(t,{fetcher:async()=>new Response('{broken')});await assert.rejects(bad.service.check(),e=>e.code==='UPDATE_INVALID');
});
test('downloads stream to a temporary file and read back in bounded chunks before replacing destination',async t=>{
 const dir=await temp(t),file=path.join(dir,'update.exe'),body=Buffer.alloc(3*1024*1024+19,45),a={...asset,size:body.length,sha256:digest(body)};await fs.writeFile(file,'original');let maxRead=0;
 const io={...fs,readFile:async()=>{throw Error('No full file read');},open:async(name,flags,...rest)=>{const h=await fs.open(name,flags,...rest);if(flags!=='r')return h;return {stat:()=>h.stat(),close:()=>h.close(),read:async(buffer,offset,size,position)=>{maxRead=Math.max(maxRead,size);return h.read(buffer,offset,Math.min(size,32001),position);}};}};
 const result=await downloadVerified(a,file,{io,fetcher:async()=>new Response(body)});assert.equal(result.verified,true);assert.equal(maxRead,256*1024);assert.equal(digest(await fs.readFile(file)),a.sha256);assert.deepEqual(await fs.readdir(dir),['update.exe']);
});
test('wrong checksum, truncation, oversized stream and rename failure preserve the existing file and clean temporary bytes',async t=>{
 const dir=await temp(t),file=path.join(dir,'update.exe');await fs.writeFile(file,'original');
 for(const body of [Buffer.from('bad'),Buffer.concat([bytes,Buffer.from('extra')]),Buffer.alloc(bytes.length)])await assert.rejects(downloadVerified(asset,file,{fetcher:async()=>new Response(body)}),e=>e.code==='UPDATE_INTEGRITY');
 await assert.rejects(downloadVerified(asset,file,{fetcher:async()=>new Response(bytes),io:{...fs,rename:async()=>{throw Error('disk failure');}}}));assert.equal(await fs.readFile(file,'utf8'),'original');assert.deepEqual(await fs.readdir(dir),['update.exe']);
});
test('only known GitHub asset redirects are followed, without cookies or private request content',async t=>{
 for(const url of ['http://github.com/x','file:///tmp/a','https://evil.test/a','https://release-assets.githubusercontent.com.evil.test/a','https://user:pass@objects.githubusercontent.com/a'])assert.throws(()=>downloadURL(url,asset.url));
 const dir=await temp(t),file=path.join(dir,'update.exe');let calls=[];
 await downloadVerified(asset,file,{fetcher:async(url,o)=>{calls.push(url);assert.equal(o.credentials,'omit');assert.equal(o.body,undefined);return calls.length===1?new Response(null,{status:302,headers:{location:'https://release-assets.githubusercontent.com/asset?token=test'}}):new Response(bytes);}});assert.equal(calls.length,2);
 await assert.rejects(downloadVerified(asset,file,{fetcher:async()=>new Response(null,{status:302,headers:{location:'https://evil.test/run.exe'}})}),e=>e.code==='UPDATE_INVALID');
});
test('download cancel interrupts an active stream and removes only its temporary file',async t=>{
 const dir=await temp(t),file=path.join(dir,'update.exe'),controller=new AbortController();await fs.writeFile(file,'original');let sent=false;
 const fetcher=async()=>new Response(new ReadableStream({pull(c){if(!sent){sent=true;c.enqueue(bytes.subarray(0,3));}}}));
 await assert.rejects(downloadVerified(asset,file,{fetcher,controller,progress:()=>controller.abort(Object.assign(Error('cancel'),{code:'UPDATE_CANCELLED'}))}),e=>e.code==='UPDATE_CANCELLED');
 assert.equal(await fs.readFile(file,'utf8'),'original');assert.deepEqual(await fs.readdir(dir),['update.exe']);
});
test('stalled download aborts, closes its stream and preserves the old destination',async t=>{
 const dir=await temp(t),file=path.join(dir,'update.exe');await fs.writeFile(file,'original');let aborted=false;
 const fetcher=async(_url,{signal})=>new Response(new ReadableStream({start(c){signal.addEventListener('abort',()=>{aborted=true;c.error(signal.reason);},{once:true});}}));
 await assert.rejects(downloadVerified(asset,file,{fetcher,stallMs:15}),e=>e.code==='UPDATE_TIMEOUT');assert.equal(aborted,true);assert.equal(await fs.readFile(file,'utf8'),'original');assert.deepEqual(await fs.readdir(dir),['update.exe']);
});
test('native file-picker cancellation, wrong extension and concurrent checks never download or overwrite files',async t=>{
 const f=await fixture(t,{dialog:{showSaveDialog:async()=>({canceled:true})}});await f.service.check();await assert.rejects(f.service.download(),e=>e.code==='UPDATE_CANCELLED');assert.equal(f.requests.length,1);
 const wrong=await fixture(t,{dialog:{showSaveDialog:async()=>({filePath:path.join(os.tmpdir(),'wrong.txt')})}});await wrong.service.check();await assert.rejects(wrong.service.download(),e=>e.code==='UPDATE_EXTENSION');assert.equal(wrong.requests.length,1);
 let releaseFetch;const pending=await fixture(t,{fetcher:()=>new Promise(resolve=>{releaseFetch=resolve;})});const p=pending.service.check();while(!releaseFetch)await new Promise(r=>setImmediate(r));await assert.rejects(pending.service.check(),e=>e.code==='DESKTOP_BUSY');releaseFetch(Response.json([release()]));await p;
});
test('installer opening requires confirmation, compatible verified backup and a fresh hash check; then quits',async t=>{
 const f=await fixture(t);await f.service.check();await f.service.download();f.setConfirm(0);await assert.rejects(f.service.install(backup),e=>e.code==='UPDATE_CANCELLED');assert.equal(f.opened.length,0);
 f.setConfirm(1);f.setSave({ok:false,code:'SAVE_CANCELLED'});await assert.rejects(f.service.install(backup),e=>e.code==='UPDATE_CANCELLED');assert.equal(f.opened.length,0);
 f.setSave({ok:false,code:'SAVE_FAILED'});await assert.rejects(f.service.install(backup),e=>e.code==='UPDATE_BACKUP_FAILED');assert.equal(f.opened.length,0);
 f.setSave({ok:true,verified:true,fileName:'backup.json'});const result=await f.service.install(backup);assert.equal(result.phase,'opened');assert.equal(f.opened[0],f.destination);await new Promise(r=>setImmediate(r));assert.equal(f.quits(),1);
});
test('replaced/corrupt installer and incompatible backup cannot be opened; shell failure does not quit',async t=>{
 const f=await fixture(t);await f.service.check();await f.service.download();await assert.rejects(f.service.install('{}'),e=>e.code==='INVALID_BACKUP');
 await fs.writeFile(f.destination,Buffer.alloc(bytes.length));await assert.rejects(f.service.install(backup),e=>e.code==='UPDATE_INTEGRITY');assert.equal(f.opened.length,0);assert.equal(f.quits(),0);
 const failed=await fixture(t,{openPath:async()=> 'OS blocked opening'});await failed.service.check();await failed.service.download();await assert.rejects(failed.service.install(backup),e=>e.code==='UPDATE_OPEN_FAILED');assert.equal(failed.quits(),0);
});
test('update UI is local at startup, escapes release notes, and cancels even while its check is pending',async()=>{
 const source=await fs.readFile(new URL('../native-desktop/renderer/updates.js',import.meta.url),'utf8');let click,cancelled=0,checks=0,done,body,listener;
 const s={current:{version:'5.0.0',sequence:5,build:'5000107',platform:'win32',arch:'x64'},latest:releaseInfo(release(),'win32','x64'),phase:'idle',checkedAt:'2026-10-19T12:00:00Z',fresh:true,available:true,canDownload:true};
 const bridge={onUpdateState:fn=>{listener=fn;return ()=>{};},updateState:async()=>s,checkUpdates:()=>{checks++;return new Promise(r=>{done=r;});},cancelUpdate:async()=>{cancelled++;}};
 const context={SalaryMateDesktop:bridge,document:{addEventListener:(_name,fn)=>{click=fn;},querySelector:()=>null},addEventListener(){}};vm.runInNewContext(source,context);assert.equal(checks,0);
 context.SalaryMateDesktopUpdates.attach({open:(_title,html)=>{body=html;},toast(){}});await context.SalaryMateDesktopUpdates.open();assert.ok(body.includes('&lt;script&gt;'));assert.ok(!body.includes('<script>'));assert.equal(checks,0);
 const press=kind=>click({target:{closest:()=>({dataset:{updateAction:kind}})},preventDefault(){},stopImmediatePropagation(){}});press('check');await new Promise(r=>setImmediate(r));press('cancel');await new Promise(r=>setImmediate(r));assert.equal(cancelled,1);done(s);
});

test('update UI distinguishes version-state write failure and disables packages during recovery',async()=>{
 const source=await fs.readFile(new URL('../native-desktop/renderer/updates.js',import.meta.url),'utf8');let body;
 const s={current:{version:'5.3.1',sequence:1,build:'5030101',platform:'win32',arch:'x64'},phase:'error',error:'UPDATE_STATE_WRITE',content:{enabled:false,storageError:true,rolledBack:true,canRollback:false}};
 const context={SalaryMateDesktop:{onUpdateState:()=>()=>{},updateState:async()=>s},document:{addEventListener(){},querySelector:()=>null},addEventListener(){}};
 vm.runInNewContext(source,context);context.SalaryMateDesktopUpdates.attach({open:(_title,html)=>{body=html;},toast(){}});
 await context.SalaryMateDesktopUpdates.open();assert.match(body,/無法保存版本還原紀錄/);assert.match(body,/磁碟空間與資料夾寫入權限/);
 assert.doesNotMatch(body,/data-update-action="(?:import|rollback)"/);assert.doesNotMatch(body,/無法連線/);
});

test('update UI identifies packaged-file read failures and reports only safe unknown error codes',async()=>{
 const source=await fs.readFile(new URL('../native-desktop/renderer/updates.js',import.meta.url),'utf8');let body;
 const s={current:{version:'5.3.1',sequence:3,platform:'win32',arch:'x64'},phase:'error',error:'BACKUP_UNREADABLE'};
 const context={SalaryMateDesktop:{onUpdateState:()=>()=>{},updateState:async()=>s},document:{addEventListener(){},querySelector:()=>null},addEventListener(){}};
 vm.runInNewContext(source,context);context.SalaryMateDesktopUpdates.attach({open:(_title,html)=>{body=html;},toast(){}});
 await context.SalaryMateDesktopUpdates.open();assert.match(body,/無法讀取更新所需的檔案/);assert.match(body,/完整內容套件/);assert.doesNotMatch(body,/操作未完成，請重試/);
 s.error='EACCES';await context.SalaryMateDesktopUpdates.open();assert.match(body,/\(EACCES\)/);
 s.error='private/path/<script>';await context.SalaryMateDesktopUpdates.open();assert.doesNotMatch(body,/private\/path/);
});
